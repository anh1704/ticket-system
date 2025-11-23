import { useEffect, useState, useMemo } from "react";
import {
  Package,
  ShoppingCart,
  X,
  Check,
  AlertCircle,
  Calendar,
  MapPin,
  Ticket,
} from "lucide-react";

// --- 1. Định nghĩa Interface ---
interface Item {
  item_id: string;
  name: string;
  item_name: string;
  unit: string;
  status: string;
  description: string;
  rate: number;
  stock_on_hand: number;
  available_stock: number;
  actual_available_stock: number;
  sku: string;
  item_type: string;
  product_type: string;
  created_time: string;
  last_modified_time: string;
  cf_date_and_time?: string;
  cf_location?: string;
  // Nếu API có trả về custom_fields thì thêm vào đây, hiện tại dùng description để demo
}

// Interface cho Sự kiện (Show) sau khi đã gom nhóm
interface GroupedEvent {
  code: string; // Mã Show (ví dụ: HAT2025)
  name: string; // Tên Show (Hà Anh Tuấn...)
  minPrice: number; // Giá thấp nhất
  totalStock: number; // Tổng vé
  available: number; // Có sẵn
  actual: number; // Thực tế
  zones: Item[]; // Danh sách các hạng vé con
}

function App() {
  const [rawItems, setRawItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API Lấy danh sách
  const API_URL =
    "https://n8n-group5.len-handmade.top/webhook/5ce3f9d5-87e4-4555-a5ad-127136953a14";
  // API Đặt vé (Gộp)
  const API_BOOKING =
    "https://n8n-group5.len-handmade.top/webhook/abdd44ea-1757-43f2-9007-019c047e79af";

  // --- 2. Fetch Data ---
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    // clear top-right notifications for a fresh fetch
    setSubmitError(null);
    try {
      const response = await fetch(API_URL);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      // Xử lý trường hợp API trả về { items: [...] } hoặc [...]
      const itemsArray = Array.isArray(data) ? data : data.items || [];
      setRawItems(itemsArray);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch data";
      setError(msg);
      // also show the error as a top-right notification card
      setSubmitError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- 3. Thuật toán Gom nhóm SKU (Logic cốt lõi) ---
  const events = useMemo(() => {
    const groups: Record<string, GroupedEvent> = {};

    rawItems.forEach((item) => {
      // Logic tách SKU: HAT2025-VIP -> Lấy HAT2025
      // Nếu không có SKU thì dùng ID làm key tạm
      const skuPrefix = item.sku
        ? item.sku.split("-")[0]
        : `UNKNOWN_${item.item_id}`;

      if (!groups[skuPrefix]) {
        // Tạo nhóm mới nếu chưa có
        groups[skuPrefix] = {
          code: skuPrefix,
          name: item.name.split("-")[0].trim(), // Lấy phần tên trước dấu gạch (nếu có)
          minPrice: item.rate,
          totalStock: 0,
          available: 0,
          actual: 0,
          zones: [],
        };
      }

      // Cập nhật số liệu tổng hợp
      const group = groups[skuPrefix];
      group.zones.push(item);
      group.totalStock += item.stock_on_hand;
      group.available += item.available_stock;
      group.actual += item.actual_available_stock;
      if (item.rate < group.minPrice) group.minPrice = item.rate;
    });

    return Object.values(groups);
  }, [rawItems]);

  // --- Format Helpers ---
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  // --- 4. Booking State ---
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<GroupedEvent | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(""); // ID của hạng vé đang chọn trong dropdown

  const [booking, setBooking] = useState({
    customerName: "",
    phone: "",
    email: "",
    quantity: 1,
    paymentMethod: "cash",
  });

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Khi bấm "Đặt vé ngay" ở ngoài trang chủ
  const openBookingModal = (event: GroupedEvent) => {
    setSelectedEvent(event);
    // Mặc định chọn hạng vé đầu tiên
    if (event.zones.length > 0) {
      setSelectedZoneId(event.zones[0].item_id);
    }
    setBooking({
      customerName: "",
      phone: "",
      email: "",
      quantity: 1,
      paymentMethod: "cash",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedEvent(null);
  };

  const handleChange = (field: string, value: string | number) => {
    setBooking((b) => ({ ...b, [field]: value }));
  };

  // Tính toán item đang được chọn trong Modal
  const currentZone = useMemo(() => {
    if (!selectedEvent) return null;
    return (
      selectedEvent.zones.find((z) => z.item_id === selectedZoneId) ||
      selectedEvent.zones[0]
    );
  }, [selectedEvent, selectedZoneId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentZone) return;
    const payload = {
      customerName: booking.customerName,
      email: booking.email,
      phone: booking.phone,
      quantity: booking.quantity,
      ticket_price: currentZone.rate,
      total: currentZone.rate * booking.quantity,
      payment_method: booking.paymentMethod,
      item_name: currentZone.name,
      item_id: currentZone.item_id, // Gửi đúng ID của hạng vé đang chọn
    };

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(API_BOOKING, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Lỗi kết nối n8n");

      const data = await res.json();
      console.log("Success:", data);
      // show in-page success message instead of alert
      setSubmitSuccess(
        `Vé "${currentZone.name}" đã được gửi tới email của bạn.`
      );
      closeModal();
      fetchData(); // Load lại dữ liệu mới
    } catch (err) {
      console.error(err);
      setSubmitError("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // auto-dismiss success message after a few seconds
  useEffect(() => {
    if (!submitSuccess) return;
    const t = setTimeout(() => setSubmitSuccess(null), 4500);
    return () => clearTimeout(t);
  }, [submitSuccess]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50">
      {/* Submit success / error notification cards */}
      {submitSuccess && (
        <div className="fixed top-6 right-6 z-50 w-[320px]">
          <div className="bg-green-50 border-l-4 border-green-500 text-green-700 px-6 py-4 rounded-lg shadow-md">
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 flex-shrink-0 text-green-600" />
              <div>
                <div className="font-semibold">Đặt vé thành công</div>
                <div className="text-sm mt-1">{submitSuccess}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      {submitError && (
        <div className="fixed top-6 right-6 z-50 w-[320px]">
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-lg shadow-md">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
              <div>
                <div className="font-semibold">Lỗi</div>
                <div className="text-sm mt-1">{submitError}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Header Banner */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="bg-gradient-to-r from-blue-500 to-sky-400 rounded-2xl p-6 text-white flex items-center gap-5 shadow-inner border border-white/20">
            <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md shadow-sm">
              <Package className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                Hệ Thống Quản Lí Vé Sự Kiện
              </h1>
              <p className="text-blue-100 mt-1 opacity-90">
                Hệ thống đặt vé trực tuyến nhanh chóng và tiện lợi
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl pb-20">
        {/* Title Section */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-blue-600">Danh Sách Show</h2>
          <div className="bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-200">
            <span className="text-sm text-slate-500">Tổng số: </span>
            <span className="font-bold text-slate-700">
              {events.length} shows
            </span>
          </div>
        </div>

        {/* Loading & Error States */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-lg mb-6 shadow-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="text-center py-10">
            <div
              className="animate-spin inline-block w-10 h-10 border-4 border-current border-t-transparent text-blue-600 rounded-full"
              role="status"
            ></div>
            <p className="mt-2 text-slate-500">Đang tải dữ liệu...</p>
          </div>
        )}

        {/* --- DANH SÁCH SỰ KIỆN (Theo thiết kế hình 1) --- */}
        <div className="space-y-8">
          {events.map((event) => (
            <div
              key={event.code}
              className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-100 transition-all hover:shadow-xl"
            >
              {/* 1. Tên Sự Kiện (Header xanh) */}
              <div className="bg-[#0ea5e9] p-4 flex justify-between items-center">
                <h3 className="text-white text-xl font-bold uppercase tracking-wide">
                  {event.name}
                </h3>
                <div className="bg-white/20 p-1.5 rounded-full text-white">
                  <Check className="w-5 h-5" />
                </div>
              </div>

              <div className="p-6">
                {/* 2. Bảng Thống Kê (4 ô màu) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      GIÁ THẤP NHẤT
                    </span>
                    <p className="text-xl font-bold text-blue-600">
                      {formatCurrency(event.minPrice)}
                    </p>
                  </div>
                  <div className="bg-cyan-50 p-3 rounded-lg border border-cyan-100">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      TỔNG SỐ VÉ
                    </span>
                    <p className="text-xl font-bold text-cyan-600">
                      {event.totalStock}
                    </p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      CÓ SẴN
                    </span>
                    <p className="text-xl font-bold text-green-600">
                      {event.available}
                    </p>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      THỰC TẾ
                    </span>
                    <p className="text-xl font-bold text-amber-600">
                      {event.actual}
                    </p>
                  </div>
                </div>

                {/* 3. Danh sách hạng vé chi tiết */}
                <div className="space-y-3 mb-6">
                  {event.zones.map((zone) => (
                    <div
                      key={zone.item_id}
                      className="flex flex-col md:flex-row md:items-center justify-between py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 px-2 rounded-md transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-800 text-md">
                            {zone.name}
                          </span>
                          <span className="text-slate-400 mx-1">-</span>
                          <span className="font-bold text-slate-800">
                            {formatCurrency(zone.rate)}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {zone.cf_date_and_time || "Đang cập nhật ngày"}
                          <span className="mx-1">|</span>
                          <MapPin className="w-3 h-3" />
                          {zone.cf_location || "Đang cập nhật địa điểm"}
                        </div>
                      </div>
                      <div className="mt-2 md:mt-0">
                        <span
                          className={`text-sm font-bold ${
                            zone.stock_on_hand > 0
                              ? "text-green-600"
                              : "text-red-500"
                          }`}
                        >
                          {zone.stock_on_hand} vé
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 4. Nút Đặt Vé (Footer) */}
                <button
                  onClick={() => openBookingModal(event)}
                  className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold py-3.5 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-5 h-5" /> Đặt Vé Ngay
                </button>
              </div>
            </div>
          ))}
        </div>

        {!loading && events.length === 0 && (
          <div className="text-center text-slate-500 py-10 bg-white rounded-xl shadow-sm">
            Hiện chưa có sự kiện nào.
          </div>
        )}
      </div>

      {/* --- MODAL ĐẶT VÉ (Theo thiết kế hình 2) --- */}
      {modalOpen && selectedEvent && currentZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          ></div>

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10 overflow-hidden relative">
            {/* Modal Header */}
            <div className="bg-[#0ea5e9] p-5 flex justify-between items-center text-white">
              <h3 className="text-xl font-bold">Đặt Vé</h3>
              <button
                onClick={closeModal}
                className="bg-white/20 hover:bg-white/30 rounded-full p-1.5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-5 max-h-[85vh] overflow-y-auto"
            >
              {/* Event Info Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    TÊN SỰ KIỆN
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    GIÁ VÉ
                  </span>
                </div>
                <div className="flex justify-between items-start">
                  <h4 className="text-lg font-bold text-slate-800 w-2/3">
                    {selectedEvent.name}
                  </h4>
                  <span className="text-lg font-bold text-blue-600">
                    {formatCurrency(currentZone.rate)}
                  </span>
                </div>
              </div>

              {/* Zone Selector (Dropdown) - Quan trọng */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Chọn zone / vé
                </label>
                <div className="relative">
                  <select
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none font-medium"
                    value={selectedZoneId}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                  >
                    {selectedEvent.zones.map((zone) => (
                      <option key={zone.item_id} value={zone.item_id}>
                        {zone.name} - {formatCurrency(zone.rate)}
                      </option>
                    ))}
                  </select>
                  <Ticket className="absolute right-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
              </div>
              {/* Form Fields */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tên khách hàng *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Nhập họ tên đầy đủ"
                  value={booking.customerName}
                  onChange={(e) => handleChange("customerName", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Số điện thoại *
                  </label>
                  <input
                    required
                    type="tel"
                    placeholder="0912345678"
                    value={booking.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Email *
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="email@example.com"
                    value={booking.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Số lượng vé *
                  </label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={currentZone.available_stock || 99}
                    value={booking.quantity}
                    onChange={(e) =>
                      handleChange("quantity", Number(e.target.value))
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Thanh toán *
                  </label>
                  <select
                    value={booking.paymentMethod}
                    onChange={(e) =>
                      handleChange("paymentMethod", e.target.value)
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
                  >
                    <option value="cash">Tiền mặt</option>
                    <option value="transfer">Chuyển khoản</option>
                  </select>
                </div>
              </div>

              {/* Total Calculation */}
              <div className="bg-green-50 p-4 rounded-xl border border-green-200 flex justify-between items-center">
                <span className="font-bold text-slate-700">
                  Tổng thanh toán:
                </span>
                <span className="text-2xl font-extrabold text-green-600">
                  {formatCurrency(currentZone.rate * booking.quantity)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="flex-1 py-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg font-bold shadow-md transition transform duration-150 ease-in-out active:scale-95 active:translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      <span>Đang xử lí</span>
                    </>
                  ) : (
                    <span>Xác nhận đặt vé</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
