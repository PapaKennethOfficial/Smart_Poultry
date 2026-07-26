"""Vehicle Routing Problem (VRP) solver using Google OR-Tools.

Problem shape
    Single depot, multiple vehicles, capacity-constrained. Each stop has
    a coordinate (lat/lon) and a demand (quantity). We minimise the total
    great-circle distance across all vehicle routes.

Approach
    Distances are computed with the haversine formula (straight-line
    across the Earth's surface). This is fast and needs no external
    routing API. If real routing is needed later, swap the distance
    matrix builder for one that calls OSRM / Google Directions.

The implementation follows OR-Tools' official CVRP sample (Google, 2024)
but with real-world lat/lon inputs and a clean pure-Python interface so
FastAPI can hand it a request body and get a JSON-friendly result back.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List

from loguru import logger
from ortools.constraint_solver import pywrapcp, routing_enums_pb2


# ─── Distance ───────────────────────────────────────────────────────────────

_EARTH_RADIUS_M = 6_371_000


def haversine_metres(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lon points, in whole metres."""
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlat = rlat2 - rlat1
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    return int(round(2 * _EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))))


# ─── Public API ─────────────────────────────────────────────────────────────

@dataclass
class Stop:
    id: str
    lat: float
    lon: float
    demand: int = 1


@dataclass
class Vehicle:
    id: str
    capacity: int = 999_999


def _build_distance_matrix(points: List[tuple[float, float]]) -> List[List[int]]:
    n = len(points)
    matrix = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = haversine_metres(points[i][0], points[i][1], points[j][0], points[j][1])
            matrix[i][j] = d
            matrix[j][i] = d
    return matrix


def solve(
    depot: Stop,
    stops: List[Stop],
    vehicles: List[Vehicle],
    time_limit_seconds: int = 5,
) -> dict:
    """Solve a capacity-constrained VRP.

    Returns a plain dict — no OR-Tools objects escape the function, so it's
    JSON-serialisable and easy to unit-test.
    """
    if not stops:
        return {
            "routes": [{"vehicle_id": v.id, "sequence": [depot.id], "distance_m": 0} for v in vehicles],
            "total_distance_m": 0,
            "unassigned": [],
        }
    if not vehicles:
        raise ValueError("At least one vehicle is required")

    # Index 0 is always the depot in the OR-Tools model.
    all_nodes = [depot] + stops
    points = [(n.lat, n.lon) for n in all_nodes]
    demands = [n.demand for n in all_nodes]
    capacities = [v.capacity for v in vehicles]

    distance_matrix = _build_distance_matrix(points)

    manager = pywrapcp.RoutingIndexManager(len(all_nodes), len(vehicles), 0)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index: int, to_index: int) -> int:
        return distance_matrix[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)]

    transit_cb_idx = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_cb_idx)

    def demand_callback(from_index: int) -> int:
        return demands[manager.IndexToNode(from_index)]

    demand_cb_idx = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_cb_idx,
        0,               # null capacity slack
        capacities,      # vehicle-specific capacities
        True,            # start cumul to zero
        "Capacity",
    )

    # Allow the solver to leave stops unassigned rather than fail hard when
    # the fleet is too small — better UX than a 500 error.
    penalty = sum(distance_matrix[0][i] for i in range(1, len(all_nodes))) * 10
    for node in range(1, len(all_nodes)):
        routing.AddDisjunction([manager.NodeToIndex(node)], penalty)

    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_params.time_limit.FromSeconds(time_limit_seconds)

    solution = routing.SolveWithParameters(search_params)
    if solution is None:
        logger.warning("OR-Tools returned no solution for {} stops, {} vehicles", len(stops), len(vehicles))
        raise RuntimeError("Routing solver could not find a solution")

    routes = []
    total_distance = 0
    visited = set()
    for v_idx, vehicle in enumerate(vehicles):
        index = routing.Start(v_idx)
        sequence: List[str] = []
        route_distance = 0
        prev_node = None
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            sequence.append(all_nodes[node].id)
            if node != 0:
                visited.add(node)
            next_index = solution.Value(routing.NextVar(index))
            if prev_node is not None:
                route_distance += distance_matrix[prev_node][node]
            prev_node = node
            index = next_index
        # Close the route at the depot
        end_node = manager.IndexToNode(index)
        sequence.append(all_nodes[end_node].id)
        if prev_node is not None:
            route_distance += distance_matrix[prev_node][end_node]
        total_distance += route_distance
        routes.append({
            "vehicle_id": vehicle.id,
            "sequence": sequence,
            "distance_m": route_distance,
        })

    unassigned = [
        all_nodes[i].id
        for i in range(1, len(all_nodes))
        if i not in visited
    ]

    return {
        "routes": routes,
        "total_distance_m": total_distance,
        "unassigned": unassigned,
    }
