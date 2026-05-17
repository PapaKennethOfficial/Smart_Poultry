# 🐔 Smart Poultry Management System

A next-generation, AI-driven full-stack web application designed to revolutionize poultry farming. This system goes beyond mere farm management by integrating advanced Artificial Intelligence and Machine Learning directly into its core. 

By autonomously performing extensive quantitative and predictive analyses on farm data, it completely eliminates the need for external data scientists or analysts. The platform provides actionable insights and forecasts the future trajectory of the farm, all while seamlessly managing daily operations and complex supply deliveries.

## 🌟 Core Features

- **🧠 Advanced AI & Machine Learning Analytics**:
  - **Autonomous Data Science**: The system acts as your personal data analyst, processing vast amounts of farm data to uncover hidden patterns.
  - **Predictive Modeling**: Forecasts future farm conditions, including predicted yield, potential mortality risks, and optimal harvest times.
  - **Quantitative Analysis**: Deep statistical insights into feed conversion ratios, environmental impact on growth, and financial projections.
  - **Future Trajectory**: Provides a strategic outlook on the farm's future performance based on current and historical data trends.

- **🚚 Integrated Delivery Management System**: 
  - Comprehensive supply chain tracking for customer orders, feed, medication, and equipment.
  - Real-time GPS mapping and driver tracking powered by Leaflet.
  - Automated status updates and transparent logistics overview directly within the platform.

- **📊 Dynamic Dashboard**: Real-time overview of key farm metrics, current batches, active alerts, and day-to-day operational statuses.
- **📓 Digital Logbook**: Granular recording of daily metrics, including mortality rates, feed consumption, water usage, and environmental conditions (temperature/humidity).
- **📈 Automated Reports**: Visualize farm data through rich, interactive charts to make immediate, informed decisions.
- **🔐 Secure Authentication**: Robust role-based access control (Admin, Manager, Worker) to ensure data privacy and operational security.

## 💻 Tech Stack

### Frontend
- **Framework**: [React](https://react.dev/) (powered by [Vite](https://vitejs.dev/))
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Routing**: [React Router](https://reactrouter.com/)
- **State/Data Fetching**: [React Query](https://tanstack.com/query/v3) & [Axios](https://axios-http.com/)
- **Maps & Tracking**: [Leaflet](https://leafletjs.com/) & [React-Leaflet](https://react-leaflet.js.org/)
- **Charts**: [Recharts](https://recharts.org/)

### Backend
- **Environment**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Authentication**: JWT & bcrypt
- **Validation**: [Zod](https://zod.dev/)
- **AI/ML Capabilities**: *(Data aggregation & predictive pipeline integrations)*

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites
- Node.js (v18 or higher recommended)
- PostgreSQL database

### 1. Clone the repository

```bash
git clone https://github.com/PapaKennethOfficial/Smart_Poultry.git
cd Smart_Poultry
```

### 2. Backend Setup

Navigate to the backend directory and configure the environment:

```bash
cd smartpoultry-backend
npm install
```

Create a `.env` file based on the provided example:

```bash
cp .env.example .env
```

Update the `.env` file with your PostgreSQL connection string and a secret for JWT:

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/smartpoultry"
JWT_SECRET="your_secure_jwt_secret"
PORT=3000
CLIENT_URL="http://localhost:5173"
```

Run database migrations and seed initial data (like the admin user):

```bash
npx prisma migrate dev
npm run db:seed
```

Start the backend server:

```bash
npm run dev
```

### 3. Frontend Setup

Open a new terminal window, navigate to the project root, and install frontend dependencies:

```bash
# From the root directory of the project
npm install
```

Start the frontend development server:

```bash
npm run dev
```

The application should now be running at `http://localhost:5173`.

## 📂 Project Structure

```text
smartpoultry/
├── smartpoultry-backend/   # Node.js + Express + Prisma backend
│   ├── prisma/             # Database schema and seed scripts
│   ├── src/                # Backend source code
│   │   ├── middleware/     # Custom Express middlewares
│   │   ├── routes/         # API endpoints
│   │   └── ...
│   ├── app.js              # Express app setup
│   └── server.js           # Server entry point
├── src/                    # React frontend source code
│   ├── components/         # Reusable UI components
│   ├── pages/              # Application views (Dashboard, Deliveries, etc.)
│   └── ...
├── public/                 # Static assets
├── package.json            # Frontend dependencies and scripts
└── vite.config.js          # Vite configuration
```

## 📝 License

This project is licensed under the ISC License.
