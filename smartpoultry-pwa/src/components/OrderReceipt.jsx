import React from 'react'

export default function OrderReceipt({ order }) {
  if (!order) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="receipt-container bg-white p-6 rounded-xl border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">SmartPoultry</h2>
          <p className="text-sm text-gray-500">Official Receipt</p>
        </div>
        <button 
          onClick={handlePrint}
          className="print-hidden px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200"
        >
          Print Receipt
        </button>
      </div>

      <div className="border-t border-b border-gray-100 py-4 mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Order ID:</span>
          <span className="font-semibold text-gray-800">{order.orderId}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Date:</span>
          <span className="font-semibold text-gray-800">{new Date(order.createdAt).toLocaleDateString()}</span>
        </div>
        {order.customer?.name && (
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Customer Name:</span>
            <span className="font-semibold text-gray-800">{order.customer.name}</span>
          </div>
        )}
        {order.customer?.phone && (
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Phone:</span>
            <span className="font-semibold text-gray-800">{order.customer.phone}</span>
          </div>
        )}
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Delivery Address:</span>
          <span className="font-semibold text-gray-800 text-right max-w-[60%]">{order.address}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Delivery Date:</span>
          <span className="font-semibold text-gray-800">{new Date(order.deliveryDate).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Payment Method:</span>
          <span className="font-semibold text-gray-800">{order.paymentMethod ? order.paymentMethod.replace('_', ' ') : 'N/A'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Payment Status:</span>
          <span className="font-semibold text-gray-800">{order.paymentStatus ? order.paymentStatus.replace('_', ' ') : 'PENDING'}</span>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Item Details</h3>
        <div className="flex justify-between items-center mb-2">
          <div>
            <div className="font-medium text-gray-800">{order.product?.name}</div>
            <div className="text-sm text-gray-500">Qty: {order.quantity}</div>
          </div>
          <div className="font-semibold text-gray-800">GHS {order.amount.toFixed(2)}</div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
        <span className="font-bold text-gray-800">Total</span>
        <span className="font-bold text-lg text-green-600">GHS {order.amount.toFixed(2)}</span>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .receipt-container, .receipt-container * {
            visibility: visible;
          }
          .receipt-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            box-shadow: none;
          }
          .print-hidden {
            display: none;
          }
        }
      `}} />
    </div>
  )
}
