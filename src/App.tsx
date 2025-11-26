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

// --- 1. ĐỊNH NGHĨA INTERFACE ---
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
  cf_time_unformatted?: string;
  cf_location?: string;
}

interface GroupedEvent {
  code: string;
  name: string;
  minPrice: number;
  totalStock: number;
  available: number;
  actual: number;
  zones: Item[];
}

// --- TỶ GIÁ QUY ĐỔI (USD -> VND) ---
const EXCHANGE_RATE = 26000; 

function App() {
  // --- STATE ---
  const [rawItems, setRawItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [_error, setError] = useState<string | null>(null);

  // --- CẤU HÌNH API ---
  const API_GET_URL = "https://n8n-group5.len-handmade.top/webhook/1cb7e2e7-bdb0-406e-82b6-799ffbd85625";
  const API_BOOKING_CASH = "https://n8n-group5.len-handmade.top/webhook/1cb7e2e7-bdb0-406e-82b6-799ffbd85625"; 
  const API_BOOKING_PAYPAL = "https://n8n-group5.len-handmade.top/webhook/abdd44ea-1757-43f2-9007-019c047e79af";

  // --- FETCH DATA ---
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setSubmitError(null);
    try {
      const response = await fetch(API_GET_URL);
      if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);

      const data = await response.json();
      const itemsArray = Array.isArray(data) ? data : data.items || [];
      setRawItems(itemsArray);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Không thể tải dữ liệu";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- LOGIC GOM NHÓM SKU ---
  const events = useMemo(() => {
    const groups: Record<string, GroupedEvent> = {};

    rawItems.forEach((item) => {
      const groupKey = item.name.trim();

      if (!groups[groupKey]) {
        groups[groupKey] = {
          code: groupKey,
          name: groupKey,
          minPrice: item.rate,
          totalStock: 0,
          available: 0,
          actual: 0,
          zones: [],
        };
      }

      const group = groups[groupKey];
      group.zones.push(item);

      group.totalStock += item.stock_on_hand;
      group.available += item.available_stock;
      group.actual += item.actual_available_stock;

      if (item.rate < group.minPrice) {
        group.minPrice = item.rate;
      }
    });

    return Object.values(groups);
  }, [rawItems]);

  // --- HÀM FORMAT TIỀN TỆ ---
  // Format số tiền đã được nhân tỷ giá
  const formatVND = (amount: number) => {
    // Làm tròn số tiền (Math.round)
    const roundedAmount = Math.round(amount);
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(roundedAmount);
  };
  
  // Hàm tính giá VND từ giá gốc (USD)
  const getVndPrice = (usdRate: number) => {
      return usdRate * EXCHANGE_RATE;
  };

  // --- BOOKING STATE ---
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<GroupedEvent | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");

  const [booking, setBooking] = useState({
    customerName: "",
    phone: "",
    email: "",
    quantity: 1,
    paymentMethod: "cash",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const openBookingModal = (event: GroupedEvent) => {
    setSelectedEvent(event);
    
    // Tự động chọn loại vé CÒN HÀNG đầu tiên
    const availableZone = event.zones.find(z => z.stock_on_hand > 0);
    
    if (availableZone) {
      setSelectedZoneId(availableZone.item_id);
    } else if (event.zones.length > 0) {
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

  const currentZone = useMemo(() => {
    if (!selectedEvent) return null;
    return (
      selectedEvent.zones.find((z) => z.item_id === selectedZoneId) ||
      selectedEvent.zones[0]
    );
  }, [selectedEvent, selectedZoneId]);

  // --- HÀM SUBMIT ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentZone) return;
    
    const payload = {
      customerName: booking.customerName,
      email: booking.email,
      phone: booking.phone,
      quantity: booking.quantity,
      ticket_price: currentZone.rate, // Gửi giá gốc (USD)
      total: currentZone.rate * booking.quantity, // Tổng gốc (USD)
      payment_method: booking.paymentMethod,
      item_name: currentZone.name,
      item_id: currentZone.item_id,
      // Gửi thêm thông tin quy đổi nếu cần thiết cho email/invoice
      display_price_vnd: getVndPrice(currentZone.rate),
    };

    let targetApiUrl = "";
    if (booking.paymentMethod === 'paypal') {
        targetApiUrl = API_BOOKING_PAYPAL; 
    } else {
        targetApiUrl = API_BOOKING_CASH;   
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(targetApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Lỗi kết nối tới hệ thống n8n");

      const data = await res.json();
      console.log("Success:", data);

      if (booking.paymentMethod === 'paypal' && data.redirect_url) {
          window.open(data.redirect_url, '_blank');
          setSubmitSuccess("Cửa sổ thanh toán đã mở. Vui lòng hoàn tất thanh toán ở tab mới!");
          closeModal();
          setTimeout(() => {
              // window.location.reload();
            fetchData(); 
          }, 3000);
          return;
      } 
      
      setSubmitSuccess(
        `Đặt vé thành công! Vui lòng kiểm tra email.`
      );
      
      closeModal();
      fetchData(); 
    } catch (err) {
      console.error(err);
      setSubmitError("Có lỗi xảy ra, vui lòng thử lại sau.");
      closeModal();
    } finally {
      if (booking.paymentMethod !== 'paypal') {
          setIsSubmitting(false);
      }
    }
  };

  useEffect(() => {
    if (!submitSuccess) return;
    const t = setTimeout(() => setSubmitSuccess(null), 5000);
    return () => clearTimeout(t);
  }, [submitSuccess]);

  // --- RENDER UI ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 font-sans text-slate-800">
      
      {submitSuccess && (
        <div className="fixed top-6 right-6 z-50 w-[350px] animate-bounce-in">
          <div className="bg-green-50 border-l-4 border-green-500 text-green-800 px-6 py-4 rounded-lg shadow-xl flex items-start gap-3">
            <Check className="w-6 h-6 flex-shrink-0 text-green-600" />
            <div>
              <div className="font-bold text-lg">Thành công!</div>
              <div className="text-sm mt-1">{submitSuccess}</div>
            </div>
          </div>
        </div>
      )}

      {submitError && (
        <div className="fixed top-6 right-6 z-50 w-[350px] animate-bounce-in">
          <div className="bg-red-50 border-l-4 border-red-500 text-red-800 px-6 py-4 rounded-lg shadow-xl flex items-start gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0 text-red-600" />
            <div>
              <div className="font-bold text-lg">Lỗi hệ thống</div>
              <div className="text-sm mt-1">{submitError}</div>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl p-8 text-white flex items-center gap-6 shadow-2xl">
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md shadow-inner">
            <Package className="w-12 h-12" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Hệ Thống Vé Sự Kiện</h1>
            <p className="text-blue-100 mt-2 text-lg">Đặt vé trực tuyến nhanh chóng - Thanh toán an toàn</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 max-w-6xl pb-20">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-slate-700 border-l-4 border-blue-500 pl-4">
            Sự Kiện Nổi Bật
          </h2>
          <div className="bg-white px-5 py-2 rounded-full shadow-md border border-slate-100 text-sm font-medium text-slate-600">
            Tổng số: <span className="font-bold text-blue-600 text-lg">{events.length}</span> shows
          </div>
        </div>

        {loading && (
          <div className="text-center py-20">
            <div className="animate-spin inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            <p className="mt-4 text-slate-500 font-medium">Đang tải dữ liệu mới nhất...</p>
          </div>
        )}

        <div className="grid gap-8">
          {events.map((event) => (
            <div key={event.code} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
              
              {/* Event Header (Dòng màu xanh - Giữ nguyên tên Event) */}
              <div className="bg-gradient-to-r from-sky-500 to-blue-600 p-5 flex justify-between items-center">
                <h3 className="text-white text-2xl font-bold uppercase">{event.name}</h3>
                <div className="bg-white/20 p-1.5 rounded-full text-white">
                  <Check className="w-5 h-5" />
                </div>
              </div>

              <div className="p-6">
                {/* Stats Grid - HIỂN THỊ TIỀN VND */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Giá từ</div>
                    <div className="text-xl font-bold text-blue-600">{formatVND(getVndPrice(event.minPrice))}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-100">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Tổng vé</div>
                    <div className="text-xl font-bold text-cyan-600">{event.totalStock}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Còn lại</div>
                    <div className="text-xl font-bold text-green-600">{event.available}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Thực tế</div>
                    <div className="text-xl font-bold text-amber-600">{event.actual}</div>
                  </div>
                </div>

                {/* Zone List - SỬA HIỂN THỊ SKU VÀ TIỀN VND */}
                <div className="space-y-3 mb-8">
                  {event.zones.map((zone) => (
                    <div key={zone.item_id} className="flex flex-col md:flex-row md:items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          {/* Thay Name bằng SKU */}
                          <span className="font-bold text-slate-800 text-lg">{zone.sku}</span>
                          <span className="text-slate-400 text-sm">—</span>
                          {/* Hiển thị tiền sau khi nhân 26000 */}
                          <span className="font-bold text-blue-600">{formatVND(getVndPrice(zone.rate))}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {zone.cf_time_unformatted || "Chưa cập nhật ngày"}</span>
                          <span className="text-slate-300">|</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {zone.cf_location || "Chưa cập nhật địa điểm"}</span>
                        </div>
                      </div>
                      <div className="mt-2 md:mt-0 text-right">
                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${zone.stock_on_hand > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {zone.stock_on_hand > 0 ? `Còn ${zone.stock_on_hand} vé` : 'Hết vé'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => openBookingModal(event)}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-6 h-6" /> Đặt Vé Ngay
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- MODAL ĐẶT VÉ --- */}
      {modalOpen && selectedEvent && currentZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={closeModal}></div>
          
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl z-10 overflow-hidden animate-scale-in relative flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-blue-600 p-5 flex justify-between items-center text-white flex-shrink-0">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Ticket className="w-6 h-6" /> Xác Nhận Đặt Vé
              </h3>
              <button onClick={closeModal} className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 custom-scrollbar">
              {/* Event Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">SỰ KIỆN</div>
                <h4 className="text-xl font-bold text-slate-800 mb-1">{selectedEvent.name}</h4>
                <div className="text-blue-600 font-bold text-lg">
                    {/* Giá hiển thị VND */}
                    {formatVND(getVndPrice(currentZone.rate))} 
                    <span className="text-sm text-slate-500 font-normal"> / vé</span>
                </div>
              </div>

              {/* Form */}
              <form className="space-y-5" onSubmit={handleSubmit}>
                
                {/* Zone Selection */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Chọn Loại Vé</label>
                  <div className="relative">
                    <select
                      className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-medium text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none appearance-none transition-all"
                      value={selectedZoneId}
                      onChange={(e) => setSelectedZoneId(e.target.value)}
                    >
                      {selectedEvent.zones.map((zone) => {
                        const isOutOfStock = zone.stock_on_hand <= 0;
                        return (
                          <option 
                            key={zone.item_id} 
                            value={zone.item_id}
                            disabled={isOutOfStock}
                            className={isOutOfStock ? "text-gray-400 bg-gray-100" : ""}
                          >
                            {/* Sửa hiển thị trong dropdown: SKU - Giá VND */}
                            {zone.sku} - {formatVND(getVndPrice(zone.rate))} {isOutOfStock ? '(Hết vé)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    <Ticket className="absolute right-4 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Customer Inputs */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Họ và Tên *</label>
                  <input required type="text" placeholder="Nguyễn Văn A"
                    value={booking.customerName} onChange={(e) => handleChange("customerName", e.target.value)}
                    className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Số điện thoại *</label>
                    <input required type="tel" placeholder="09xxxxxxxx"
                      value={booking.phone} onChange={(e) => handleChange("phone", e.target.value)}
                      className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Email *</label>
                    <input required type="email" placeholder="email@example.com"
                      value={booking.email} onChange={(e) => handleChange("email", e.target.value)}
                      className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Số lượng *</label>
                    <input required type="number" min={1} max={currentZone.available_stock || 99}
                      value={booking.quantity} onChange={(e) => handleChange("quantity", Number(e.target.value))}
                      className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Thanh toán *</label>
                    <select
                      value={booking.paymentMethod} onChange={(e) => handleChange("paymentMethod", e.target.value)}
                      className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                    >
                      <option value="cash">Tiền mặt</option>
                      <option value="paypal">PayPal (Thanh toán ngay)</option>
                    </select>
                  </div>
                </div>

                {/* Total - HIỂN THỊ TỔNG TIỀN VND */}
                <div className="bg-green-50 p-4 rounded-xl border-2 border-green-200 flex justify-between items-center">
                  <span className="font-bold text-slate-700">Tổng cộng:</span>
                  <span className="text-2xl font-extrabold text-green-600">
                    {formatVND(getVndPrice(currentZone.rate) * booking.quantity)}
                  </span>
                </div>

                {/* Buttons Area */}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="flex-1 py-3.5 border-2 border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || (currentZone && currentZone.stock_on_hand <= 0)}
                    className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                        <span>Đang xử lí...</span>
                      </>
                    ) : (
                      <span>
                        {booking.paymentMethod === 'paypal' ? 'Thanh toán ngay ➔' : 'Xác nhận đặt vé'}
                      </span>
                    )}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;