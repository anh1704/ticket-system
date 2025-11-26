import { useEffect, useState, useMemo } from 'react';
import { Package, Ticket, Calendar, MapPin, Loader2, AlertCircle, CheckCircle, X, Utensils, CreditCard } from 'lucide-react'; 
import { Toaster, toast } from 'sonner';

// --- 1. Interfaces ---
interface TicketItem {
  item_id: string;
  name: string;
  item_name: string;
  sku: string;
  rate: number;
  stock_on_hand: number;
  available_stock: number;
  actual_available_stock: number;
  unit: string;
  status: string;
  description: string;
  
  // Danh sách combo đi kèm (từ n8n)
  related_combos?: TicketItem[]; 

  cf_time?: string;
  cf_time_unformatted?: string;
  cf_location?: string;
  cf_location_unformatted?: string;
}

interface GroupedEvent {
  name: string;
  description: string;
  cf_time?: string;
  cf_location?: string;
  tickets: TicketItem[];
}

interface BookingSuccessInfo {
  customerName: string;
  eventName: string;
  ticketType: string;
  comboDetails?: string;
  quantity: number;
  totalPrice: number;
  paymentMethod: string;
}

// --- TỶ GIÁ QUY ĐỔI (USD -> VND) ---
const EXCHANGE_RATE = 26000; 

function App() {
  const [tickets, setTickets] = useState<TicketItem[]>([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<GroupedEvent | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string>(""); 
  const [selectedComboIds, setSelectedComboIds] = useState<string[]>([]);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successInfo, setSuccessInfo] = useState<BookingSuccessInfo | null>(null);
  
  // State để disable nút khi đang submit
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [booking, setBooking] = useState({
    customerName: '',
    phone: '',
    email: '',
    quantity: 1,
    paymentMethod: 'cash',
  });

  // URL lấy dữ liệu ban đầu
  const API_URL = "https://n8n-group5.len-handmade.top/webhook/1cb7e2e7-bdb0-406e-82b6-799ffbd85625";
  
  const PAYMENT_API_URL = "https://n8n-group5.len-handmade.top/webhook/abdd44ea-1757-43f2-9007-019c047e79af"; 

  // --- Fetch Data ---
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`Lỗi HTTP: ${res.status}`);
      
      const data: any = await res.json();
      console.log("Dữ liệu API:", data); 

      let processedData: TicketItem[] = [];

      if (data.processedTickets && Array.isArray(data.processedTickets)) {
        processedData = data.processedTickets;
      } else if (Array.isArray(data)) {
        processedData = data;
      } else if (data.items && Array.isArray(data.items)) {
        processedData = data.items;
      } else if (data.item_id) {
        processedData = [data];
      }

      setTickets(processedData);

    } catch (err: any) {
      console.error("Lỗi fetch:", err);
      setError(err.message || "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Grouping Logic ---
  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: GroupedEvent } = {};

    tickets.forEach((ticket) => {
      if (ticket.unit !== 'Ticket') return;
      if (ticket.status !== 'active') return;

      const eventName = ticket.name;
      if (!groups[eventName]) {
        groups[eventName] = {
          name: eventName,
          description: ticket.description,
          cf_time: ticket.cf_time || ticket.cf_time_unformatted, 
          cf_location: ticket.cf_location || ticket.cf_location_unformatted,
          tickets: []
        };
      }
      groups[eventName].tickets.push(ticket);
    });

    return Object.values(groups);
  }, [tickets]);

  const formatCurrency = (amount: number) => {
    if (isNaN(amount) || amount === null || amount === undefined) return '0 đ';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getCurrentTicketInfo = () => {
    if(!selectedEvent || !selectedTicketId) return null;
    return selectedEvent.tickets.find(tk => tk.item_id === selectedTicketId);
  };

  const getComboItemsForTicket = (ticket: TicketItem | null | undefined) => {
    if (!ticket || !Array.isArray(ticket.related_combos)) return [];
    return ticket.related_combos;
  };

  useEffect(() => {
    setSelectedComboIds([]); 
  }, [selectedTicketId]);

  const toggleComboItem = (itemId: string) => {
    setSelectedComboIds(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId); 
      } else {
        return [...prev, itemId];
      }
    });
  };

  // --- Booking Functions ---
  const openBooking = (event: GroupedEvent) => {
    setSelectedEvent(event);
    if (event.tickets.length > 0) {
      setSelectedTicketId(event.tickets[0].item_id);
    }
    setBooking({ customerName: '', phone: '', email: '', quantity: 1, paymentMethod: 'cash' });
    setSelectedComboIds([]); 
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedEvent(null);
    setSelectedTicketId("");
  };

  const closeSuccessModal = () => {
    setSuccessModalOpen(false);
    setSuccessInfo(null);
  };

  const handleChange = (field: string, value: string | number) => {
    setBooking((b) => ({ ...b, [field]: value }));
  };

  // --- Handle Submit (LOGIC CHÍNH ĐÃ SỬA) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentTicket = getCurrentTicketInfo();
    if (!selectedEvent || !currentTicket) return;

    // Tính toán dữ liệu
    const availableComboItems = getComboItemsForTicket(currentTicket);
    const selectedCombos = availableComboItems.filter(item => 
      selectedComboIds.includes(item.item_id)
    );
    const comboPriceTotal = selectedCombos.reduce((sum, item) => sum + item.rate, 0);
    const comboSkuString = selectedCombos.length > 0 
      ? ` + [Add-on: ${selectedCombos.map(i => i.name).join(', ')}]` 
      : '';
    const unitPrice = currentTicket.rate + comboPriceTotal;
    const totalAmount = unitPrice * booking.quantity;

    // Payload gửi đi
    const payload = {
      customerName: booking.customerName,
      email: booking.email,
      phone: booking.phone,
      quantity: booking.quantity,
      item_id: currentTicket.item_id,
      item_name: selectedEvent.name,
      sku: `${currentTicket.sku}${comboSkuString}`, 
      ticket_price: unitPrice,
      total: totalAmount,
      payment_method: booking.paymentMethod,
      // Thêm thông tin rõ ràng cho n8n xử lý payment
      combo_items: selectedComboIds, 
      currency: 'USD' 
    };

    setIsSubmitting(true); // Bắt đầu loading

    try {
      // --- TRƯỜNG HỢP 1: PAYPAL ---
      if (booking.paymentMethod === 'paypal') {
        const toastId = toast.loading("Đang kết nối cổng thanh toán PayPal...");
        
        // Gọi Webhook n8n xử lý Payment
        const res = await fetch(PAYMENT_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log("Phản hồi từ Payment Webhook:", data.redirect_url);
        if (data && (data.redirect_url)) {
             toast.dismiss(toastId);
             toast.success("Đang chuyển hướng...", { duration: 2000 });
             
             // Delay nhẹ để user đọc thông báo
            setTimeout(() => {
                // Sử dụng window.open với tham số '_blank' để mở tab mới
                const newWindow = window.open(data.redirect_url, '_blank');
                
                // Kiểm tra nếu trình duyệt chặn popup thì focus vào cửa sổ mới
                if (newWindow) {
                    newWindow.focus();
                }
            }, 1000);
        } else {
             // Fallback nếu n8n không trả về link (hoặc chỉ lưu đơn)
             toast.dismiss(toastId);
             toast.info("Đã gửi yêu cầu thanh toán. Vui lòng kiểm tra Email.");
             closeModal();
        }
      } 
      
      // --- TRƯỜNG HỢP 2: TIỀN MẶT / KHÁC ---
      else {
        const toastId = toast.loading("Đang xử lý đơn hàng...");
        
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Lỗi gửi đơn hàng");
        
        await fetchData(); // Refresh lại tồn kho

        closeModal();
        toast.dismiss(toastId);
        toast.success("Đặt vé thành công!", { duration: 3000 });

        setSuccessInfo({
          customerName: booking.customerName,
          eventName: selectedEvent.name,
          ticketType: currentTicket.sku,
          comboDetails: selectedCombos.map(i => i.name).join(', '), 
          quantity: booking.quantity,
          totalPrice: payload.total,
          paymentMethod: booking.paymentMethod
        });
        setSuccessModalOpen(true);
      }

    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra. Vui lòng thử lại sau.");
    } finally {
      setIsSubmitting(false); // Kết thúc loading
    }
  };

  // --- Render ---
  const currentTicket = getCurrentTicketInfo();
  const availableComboItems = getComboItemsForTicket(currentTicket);
  
  const currentComboPrice = availableComboItems
    .filter(item => selectedComboIds.includes(item.item_id))
    .reduce((sum, item) => sum + item.rate, 0);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Toaster position="top-right" richColors />

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="mb-12 text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-2">
            <Package className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            Sự Kiện & Vé
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Khám phá và đặt vé cho những sự kiện âm nhạc, giải trí hot nhất.
          </p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-8 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <div>
              <strong className="block font-semibold">Đã xảy ra lỗi tải dữ liệu</strong>
              <span className="text-sm opacity-90">{error}</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
            <p>Đang tải danh sách sự kiện...</p>
          </div>
        )}

        {!loading && !error && groupedEvents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {groupedEvents.map((event) => (
              <div key={event.name} className="flex flex-col bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200 overflow-hidden group">
                <div className="p-6 pb-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                  <h3 className="text-2xl font-bold mb-3 leading-tight">{event.name}</h3>
                  <div className="space-y-2 text-slate-300 text-sm">
                    {event.cf_time && (
                        <div className="flex items-start gap-2">
                             <Calendar className="w-4 h-4 mt-0.5 text-blue-400 shrink-0"/> 
                             <span>{event.cf_time}</span>
                        </div>
                    )}
                    {event.cf_location && (
                        <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 mt-0.5 text-red-400 shrink-0"/> 
                            <span className="line-clamp-2">{event.cf_location}</span>
                        </div>
                    )}
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col bg-white">
                   <div className="flex items-center gap-2 mb-4">
                      <Ticket className="w-5 h-5 text-blue-600"/>
                      <span className="font-semibold text-slate-700">Các hạng vé đang mở bán:</span>
                   </div>
                   
                   <div className="space-y-3 mb-8 flex-1">
                       {event.tickets.map(ticket => (
                           <div key={ticket.item_id} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
                               <div>
                                   <div className="font-bold text-slate-800">{ticket.sku}</div>
                                   <div className="text-xs font-medium text-slate-500 mt-0.5">
                                      {ticket.available_stock > 0 
                                        ? <span className="text-green-600">Còn {ticket.available_stock} vé</span>
                                        : <span className="text-red-500">Hết vé</span>
                                      }
                                   </div>
                               </div>
                               <div className="text-blue-700 font-bold text-lg">
                                   {formatCurrency(ticket.rate)}
                               </div>
                           </div>
                       ))}
                   </div>

                   <button
                    onClick={() => openBooking(event)}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                   >
                       Đặt Vé Ngay
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && selectedEvent && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={closeModal}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10 overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Đặt vé sự kiện</h3>
                <p className="text-xs text-slate-500 truncate max-w-[250px]">{selectedEvent.name}</p>
              </div>
              <button onClick={closeModal} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Chọn Loại Vé</label>
                  <div className="relative">
                    <select 
                      className="w-full p-3 pl-4 pr-10 appearance-none border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white font-medium text-slate-700"
                      value={selectedTicketId}
                      onChange={(e) => setSelectedTicketId(e.target.value)}
                    >
                      {selectedEvent.tickets.map(ticket => (
                          <option key={ticket.item_id} value={ticket.item_id} disabled={ticket.available_stock <= 0}>
                              {ticket.sku} - {formatCurrency(ticket.rate)} {ticket.available_stock <= 0 ? '(Hết vé)' : ''}
                          </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500">
                       <Ticket className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {availableComboItems.length > 0 && (
                   <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-3 text-orange-800 font-bold text-sm">
                        <Utensils className="w-4 h-4"/>
                        Ưu đãi Combo (Tùy chọn):
                      </div>
                      <div className="space-y-2">
                        {availableComboItems.map(item => {
                          const isSelected = selectedComboIds.includes(item.item_id);
                          return (
                            <div 
                              key={item.item_id} 
                              onClick={() => toggleComboItem(item.item_id)}
                              className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-all ${
                                isSelected 
                                  ? 'bg-orange-100 border-orange-300 shadow-sm' 
                                  : 'bg-white border-slate-200 hover:border-orange-200'
                              }`}
                            >
                               <div className="flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                    isSelected ? 'bg-orange-500 border-orange-500' : 'bg-white border-slate-300'
                                  }`}>
                                    {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                  <span className={`text-sm ${isSelected ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                                    {item.name}
                                  </span>
                               </div>
                               <span className="font-semibold text-orange-700 text-sm">+{formatCurrency(item.rate)}</span>
                            </div>
                          );
                        })}
                      </div>
                   </div>
                )}

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">Giá vé gốc:</span>
                        <span className="font-bold text-slate-800">
                            {formatCurrency(currentTicket?.rate || 0)}
                        </span>
                    </div>
                    {currentComboPrice > 0 && (
                      <div className="flex justify-between items-center text-sm animate-in slide-in-from-top-2 duration-300">
                          <span className="text-slate-600">Thêm Combo:</span>
                          <span className="font-bold text-slate-800">
                              +{formatCurrency(currentComboPrice)}
                          </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                        <span className="text-slate-700 font-bold">Thành tiền tạm tính:</span>
                        <span className="text-xl font-extrabold text-blue-700">
                            {formatCurrency(((currentTicket?.rate || 0) + currentComboPrice) * booking.quantity)}
                        </span>
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-slate-900 border-b pb-2">Thông tin người nhận</h4>
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1.5">Họ và tên</label>
                      <input
                          required
                          value={booking.customerName}
                          onChange={(e) => handleChange('customerName', e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                          placeholder="Nhập họ tên đầy đủ"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Số điện thoại</label>
                            <input
                                required
                                type="tel"
                                value={booking.phone}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                placeholder="09xxxxxxxxx"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
                            <input
                                required
                                type="email"
                                value={booking.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                placeholder="example@mail.com"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Số lượng vé</label>
                    <input
                      required
                      type="number"
                      min={1}
                      max={10}
                      value={booking.quantity}
                      onChange={(e) => handleChange('quantity', Number(e.target.value))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Hình thức thanh toán</label>
                    <select
                      value={booking.paymentMethod}
                      onChange={(e) => handleChange('paymentMethod', e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white transition"
                    >
                      <option value="cash">Tiền mặt</option>
                      <option value="paypal">PayPal</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={closeModal} 
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
                  >
                      Hủy bỏ
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className={`flex-[2] px-4 py-3 text-white rounded-xl font-bold shadow-lg transition transform active:scale-[0.98] flex items-center justify-center gap-2 
                      ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-xl'}
                      ${booking.paymentMethod === 'paypal' ? 'bg-[#003087] hover:bg-[#00256b]' : 'bg-blue-600 hover:bg-blue-700'}
                    `}
                  >
                      {isSubmitting ? (
                         <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Đang xử lý...</span>
                         </>
                      ) : (
                         booking.paymentMethod === 'paypal' ? (
                            <>
                               <span>Thanh toán ngay</span>
                               <CreditCard className="w-5 h-5 opacity-80" />
                            </>
                         ) : "Xác Nhận Đặt Vé"
                      )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {successModalOpen && successInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" onClick={closeSuccessModal}></div>
           
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md z-10 overflow-hidden relative animate-in fade-in zoom-in-95 duration-300">
             
             <div className="bg-green-600 h-32 flex items-center justify-center relative">
                <div className="bg-white p-4 rounded-full shadow-lg mt-10">
                   <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
             </div>

             <div className="px-8 pt-12 pb-8 text-center">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Đặt vé thành công!</h2>
                <p className="text-slate-500 text-sm mb-6">Cảm ơn bạn đã đặt vé. Thông tin chi tiết đã được gửi đến email của bạn.</p>
                
                <div className="bg-slate-50 rounded-2xl p-5 text-left border border-slate-100 space-y-3 mb-6 relative overflow-hidden">
                    <div className="absolute top-1/2 -left-2 w-4 h-4 bg-white rounded-full border border-slate-100"></div>
                    <div className="absolute top-1/2 -right-2 w-4 h-4 bg-white rounded-full border border-slate-100"></div>

                    <div className="flex justify-between">
                        <span className="text-slate-500 text-sm">Khách hàng</span>
                        <span className="font-semibold text-slate-800 text-sm">{successInfo.customerName}</span>
                    </div>
                    <div className="border-b border-dashed border-slate-200 my-2"></div>
                    <div>
                        <span className="text-slate-500 text-xs block mb-1">Sự kiện</span>
                        <span className="font-bold text-slate-800 block leading-tight">{successInfo.eventName}</span>
                    </div>
                    
                    {successInfo.comboDetails && (
                       <div className="mt-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">Add-on: </span>
                          {successInfo.comboDetails}
                       </div>
                    )}

                    <div className="flex justify-between items-end mt-2">
                        <div>
                             <span className="text-slate-500 text-xs block">Loại vé</span>
                             <span className="font-semibold text-blue-600">{successInfo.ticketType}</span>
                        </div>
                        <div className="text-right">
                             <span className="text-slate-500 text-xs block">Số lượng</span>
                             <span className="font-semibold text-slate-800">x{successInfo.quantity}</span>
                        </div>
                    </div>
                    <div className="border-b border-dashed border-slate-200 my-2"></div>
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-700">Tổng thanh toán</span>
                        <span className="font-extrabold text-xl text-red-600">{formatCurrency(successInfo.totalPrice)}</span>
                    </div>
                </div>

                <button 
                  onClick={closeSuccessModal}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition shadow-lg"
                >
                    Đóng và tiếp tục
                </button>
             </div>
           </div>
        </div>
      )}

    </div>
  );
}

export default App;