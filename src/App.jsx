import React, { useState, useEffect, useCallback } from "react";
import { MapPin, Camera, Send, CheckCircle2, Clock, RotateCcw, Wifi, WifiOff, Route, X, RefreshCw, AlertCircle } from "lucide-react";

const ROADS = [
  { name: "Астана - Щучинск", category: 1, since: "2013" },
  { name: "Астана - Темиртау", category: 1, since: "янв 2019" },
  { name: "Алматы - Хоргос", category: 1, since: "янв 2019" },
  { name: "Алматы - Конаев", category: 1, since: "янв 2019" },
  { name: "Астана - Павлодар", category: 1, since: "ноя 2021" },
  { name: "Тараз - Кайнар", category: 2, since: "ноя 2021" },
  { name: "Шымкент - Кызылорда", category: 2, since: "ноя 2021" },
  { name: "Шымкент - Тараз", category: 1, since: "ноя 2021" },
  { name: "Шымкент - гр. Узбекистана", category: 1, since: "ноя 2021" },
  { name: "Конаев - Талдыкорган", category: 2, since: "ноя 2021" },
  { name: "Щучинск - Кокшетау", category: 2, since: "ноя 2021" },
  { name: "Павлодар - Калбатау", category: 2, since: "2023" },
  { name: "Бейнеу - Акжигит", category: 2, since: "2023" },
  { name: "Уральск - Самара", category: 1, since: "2023" },
  { name: "Павлодар - Омск", category: 2, since: "2023" },
  { name: "Кокшетау - Петропавловск", category: 2, since: "2023" },
  { name: "Уральск - Саратов", category: 2, since: "2023" },
  { name: "Кызылорда - Аральск", category: 2, since: "2025" },
  { name: "Костанай - гр. РФ (Троицк)", category: 2, since: "2025" },
  { name: "Актобе - гр. РФ (Оренбург)", category: 2, since: "2025" },
  { name: "Костанай - Денисовка", category: 2, since: "2025" },
  { name: "Обход г. Тараз", category: 1, since: "2025" },
  { name: "Балхаш - Бурылбайтал", category: 2, since: "2025" },
  { name: "Шу - Бурылбайтал", category: 2, since: "2025" },
  { name: "Кандыагаш - Макат", category: 2, since: "2025" },
  { name: "Ушарал - Достык", category: 2, since: "2025" },
  { name: "Караганда - Балхаш - Бурылбайтал", category: 2, since: "10.07.2026" },
  { name: "Бурылбайтал - Курты", category: 2, since: "10.07.2026" },
  { name: "Талдыкорган - Усть-Каменогорск", category: 2, since: "11.07.2026" },
];

const DEFECT_TYPES = [
  "Яма в покрытии",
  "Трещина в покрытии",
  "Стёртая разметка",
  "Повреждённый отбойник",
  "Отсутствует / повреждён знак",
  "Проблема с освещением",
  "Затопление / плохой дренаж",
  "Другое",
];

const STATUS = {
  new: { label: "Новый", color: "#DC2626", bg: "#FEE2E2" },
  in_progress: { label: "В работе", color: "#EA580C", bg: "#FFEDD5" },
  resolved: { label: "Устранён", color: "#16A34A", bg: "#DCFCE7" },
};

const STORAGE_KEY = "road_defect_reports_local_demo";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  return `${Math.floor(hr / 24)} дн назад`;
}

// Локальная замена window.storage (артефактов Claude) на обычный localStorage,
// чтобы демо работало в любом браузере без бэкенда.
function loadReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveReports(reports) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch (e) {
    console.error("Storage error", e);
  }
}

function Badge({ status }) {
  const s = STATUS[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: s.bg,
        color: s.color,
        fontSize: 12,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 999,
      }}
    >
      {s.label}
    </span>
  );
}

function CameraCapture({ photos, onPhotosChange }) {
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const openCamera = async () => {
    setError("");
    setStarting(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Браузер не поддерживает доступ к камере (нужен HTTPS или localhost)");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      // видео-элемент рендерится этим же тактом; привяжем поток после рендера
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (e) {
      setError(
        e.name === "NotAllowedError"
          ? "Доступ к камере запрещён. Разрешите доступ в настройках браузера и попробуйте снова."
          : e.message || "Не удалось открыть камеру"
      );
    } finally {
      setStarting(false);
    }
  };

  const closeCamera = () => {
    stopStream();
    setCameraOpen(false);
  };

  const takeShot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    onPhotosChange([...photos, { id: uid(), src: dataUrl, takenAt: Date.now() }]);
  };

  const removePhoto = (id) => {
    onPhotosChange(photos.filter((p) => p.id !== id));
  };

  useEffect(() => {
    return () => stopStream();
  }, []);

  return (
    <div>
      {photos.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: "relative", width: 72, height: 72 }}>
              <img
                src={p.src}
                alt="Снимок дефекта"
                style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "0.5px solid var(--border-strong, #d1d5db)" }}
              />
              <button
                onClick={() => removePhoto(p.id)}
                aria-label="Удалить снимок"
                style={{
                  position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
                  background: "#DC2626", color: "#fff", border: "2px solid #fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {cameraOpen ? (
        <div style={{ border: "0.5px solid var(--border-strong, #d1d5db)", borderRadius: 10, overflow: "hidden", background: "#000" }}>
          <video ref={videoRef} playsInline muted style={{ width: "100%", display: "block", maxHeight: 280, objectFit: "cover" }} />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div style={{ display: "flex", gap: 8, padding: 8, background: "var(--surface-1, #f9fafb)" }}>
            <button onClick={takeShot} style={{ ...btnPrimary, marginTop: 0, flex: 1 }}>
              <Camera size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
              Снять кадр
            </button>
            <button onClick={closeCamera} style={btnSecondary}>
              Готово
            </button>
          </div>
        </div>
      ) : (
        <button onClick={openCamera} disabled={starting} style={btnSecondary}>
          <Camera size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
          {starting ? "Открываем камеру..." : photos.length > 0 ? "Сделать ещё фото" : "Открыть камеру"}
        </button>
      )}

      {error && (
        <div style={{ ...noteBox, background: "#FEF2F2", color: "#991B1B", display: "flex", alignItems: "flex-start", gap: 6, marginTop: 8 }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function CitizenForm({ onSubmit }) {
  const [road, setRoad] = useState("");
  const [defectType, setDefectType] = useState("");
  const [comment, setComment] = useState("");
  const [email, setEmail] = useState("");
  const [photos, setPhotos] = useState([]);
  const [locStatus, setLocStatus] = useState("idle");
  const [coords, setCoords] = useState(null);
  const [locError, setLocError] = useState("");
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState({});

  const getLocation = () => {
    setLocError("");
    if (!navigator.geolocation) {
      setLocError("Браузер не поддерживает геолокацию");
      return;
    }
    setLocStatus("getting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          accuracy: Math.round(pos.coords.accuracy),
        });
        setLocStatus("ok");
      },
      (err) => {
        setLocStatus("idle");
        if (err.code === err.PERMISSION_DENIED) {
          setLocError("Доступ к геолокации запрещён. Разрешите его в настройках браузера и попробуйте снова.");
        } else if (err.code === err.TIMEOUT) {
          setLocError("Не удалось определить местоположение за отведённое время. Попробуйте ещё раз, лучше на открытом месте.");
        } else {
          setLocError("Не удалось определить местоположение. Проверьте, включена ли геолокация на устройстве.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const validate = () => {
    const e = {};
    if (!road) e.road = "Выберите платную дорогу";
    if (!coords) e.coords = "Определите геолокацию";
    if (photos.length === 0) e.photo = "Сделайте хотя бы одно фото на месте";
    if (!defectType) e.defectType = "Выберите тип дефекта";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) e.email = "Проверьте формат email";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const report = {
      id: uid(),
      road,
      defectType,
      comment,
      email,
      photos: photos.map((p) => p.src),
      lat: coords.lat,
      lng: coords.lng,
      status: "new",
      createdAt: Date.now(),
    };
    if (!online) {
      setQueued(true);
      setTimeout(() => {
        const list = loadReports();
        saveReports([report, ...list]);
        onSubmit();
        setQueued(false);
        setSent(true);
      }, 1800);
      return;
    }
    const list = loadReports();
    saveReports([report, ...list]);
    onSubmit();
    setSent(true);
  };

  const reset = () => {
    setRoad("");
    setDefectType("");
    setComment("");
    setEmail("");
    setPhotos([]);
    setLocStatus("idle");
    setCoords(null);
    setSent(false);
    setQueued(false);
    setErrors({});
  };

  if (sent) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: "center", padding: "2.5rem 1.5rem" }}>
          <CheckCircle2 size={44} color="#16A34A" style={{ marginBottom: 12 }} />
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 500 }}>Спасибо, жалоба отправлена</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
            Дефект появится на карте КАЖ после проверки.
            {email ? " Мы напишем на email, когда дефект будет устранён." : ""}
          </p>
          <button onClick={reset} style={btnSecondary}>
            Сообщить о другом дефекте
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>Сообщить о дефекте дороги</h2>
          <button
            onClick={() => setOnline((o) => !o)}
            title="Демо-переключатель сети"
            style={{ ...iconToggle, color: online ? "#16A34A" : "#DC2626" }}
          >
            {online ? <Wifi size={16} /> : <WifiOff size={16} />}
          </button>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 20px" }}>
          Займёт меньше минуты. Загрузка фото — только с камеры, в моменте.
        </p>

        <Field label="Платная дорога" error={errors.road}>
          <select value={road} onChange={(e) => setRoad(e.target.value)} style={input}>
            <option value="">Выберите дорогу (всего 28 участков)</option>
            {ROADS.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Геолокация" error={errors.coords || locError}>
          {coords ? (
            <div>
              <div style={{ ...input, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
                <MapPin size={16} color="#16A34A" />
                {coords.lat}, {coords.lng}
                {typeof coords.accuracy === "number" && (
                  <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text-muted)" }}>
                    ±{coords.accuracy} м
                  </span>
                )}
              </div>
              <button
                onClick={getLocation}
                disabled={locStatus === "getting"}
                style={{ ...btnSecondary, marginTop: 6, height: 32, fontSize: 12.5 }}
              >
                <RefreshCw size={13} style={{ marginRight: 5, verticalAlign: -2 }} />
                {locStatus === "getting" ? "Уточняем..." : "Уточнить местоположение"}
              </button>
            </div>
          ) : (
            <button onClick={getLocation} disabled={locStatus === "getting"} style={btnSecondary}>
              <MapPin size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
              {locStatus === "getting" ? "Определяем..." : "Определить моё местоположение"}
            </button>
          )}
        </Field>

        <Field label={`Фото дефекта${photos.length ? ` (${photos.length})` : ""}`} error={errors.photo}
          hint="Можно сделать несколько кадров и удалить неудачные перед отправкой.">
          <CameraCapture photos={photos} onPhotosChange={setPhotos} />
        </Field>

        <Field label="Тип дефекта" error={errors.defectType}>
          <select value={defectType} onChange={(e) => setDefectType(e.target.value)} style={input}>
            <option value="">Выберите тип</option>
            {DEFECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Комментарий (необязательно)">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Например: яма ближе к правой полосе"
            style={{ ...input, resize: "vertical", fontFamily: "inherit", paddingTop: 8 }}
          />
        </Field>

        <Field
          label="Email (необязательно)"
          error={errors.email}
          hint="Нужен только чтобы сообщить, когда дефект устранён. Форма отправится и без него."
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={input}
          />
        </Field>

        {queued && (
          <div style={{ ...noteBox, background: "#FFF7ED", color: "#9A3412" }}>
            <WifiOff size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
            Нет сети — жалоба сохранена на устройстве и отправится автоматически при подключении...
          </div>
        )}

        <button onClick={handleSubmit} disabled={queued} style={btnPrimary}>
          <Send size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
          {queued ? "Ожидание сети..." : "Отправить"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, error, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--text-primary)" }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>{hint}</p>}
      {error && <p style={{ fontSize: 12, color: "#DC2626", margin: "4px 0 0" }}>{error}</p>}
    </div>
  );
}

function Dashboard({ reports, refresh }) {
  const [filter, setFilter] = useState("all");
  const [roadFilter, setRoadFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const filtered = reports.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (roadFilter !== "all" && r.road !== roadFilter) return false;
    return true;
  });

  const updateStatus = (id, status) => {
    const list = loadReports();
    const updated = list.map((r) => (r.id === id ? { ...r, status } : r));
    saveReports(updated);
    refresh();
    setSelected((s) => (s && s.id === id ? { ...s, status } : s));
  };

  const counts = {
    all: reports.length,
    new: reports.filter((r) => r.status === "new").length,
    in_progress: reports.filter((r) => r.status === "in_progress").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
  };

  const roadsWithReports = [...new Set(reports.map((r) => r.road))];

  return (
    <div style={{ ...wrap, maxWidth: 720 }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 500 }}>Панель КАЖ — репорты о дефектах</h2>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
          Сеть: 28 платных участков, 6 290,59 км (13 участков I категории, 15 участков II–III категории)
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {["all", "new", "in_progress", "resolved"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              ...chip,
              ...(filter === f ? chipActive : {}),
            }}
          >
            {f === "all" ? "Все" : STATUS[f].label} ({counts[f]})
          </button>
        ))}
      </div>

      {roadsWithReports.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <select value={roadFilter} onChange={(e) => setRoadFilter(e.target.value)} style={{ ...input, maxWidth: 320 }}>
            <option value="all">Все дороги</option>
            {roadsWithReports.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-secondary)" }}>
          Пока нет репортов в этой категории. Отправьте жалобу через форму жителя, чтобы увидеть, как она появится здесь.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((r) => (
            <div key={r.id} style={{ ...card, padding: "0.9rem 1.1rem", cursor: "pointer" }} onClick={() => setSelected(r)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                {r.photos && r.photos[0] && (
                  <img
                    src={r.photos[0]}
                    alt=""
                    style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
                  />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{r.defectType}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Route size={12} /> {r.road}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      marginTop: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <MapPin size={12} /> {r.lat}, {r.lng}
                    <Clock size={12} style={{ marginLeft: 8 }} /> {timeAgo(r.createdAt)}
                  </div>
                </div>
                <Badge status={r.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ minHeight: 320, position: "relative", marginTop: 16 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
            }}
            onClick={() => setSelected(null)}
          >
            <div style={{ ...card, width: 320, maxWidth: "90%" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>{selected.defectType}</h3>
                <Badge status={selected.status} />
              </div>
              {selected.photos && selected.photos.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {selected.photos.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Фото дефекта ${i + 1}`}
                      style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: "0.5px solid var(--border, #e5e7eb)" }}
                    />
                  ))}
                </div>
              )}
              <table style={{ width: "100%", fontSize: 13, marginBottom: 14 }}>
                <tbody>
                  <tr>
                    <td style={tdLabel}>Дорога</td>
                    <td style={tdVal}>{selected.road}</td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>Координаты</td>
                    <td style={tdVal}>
                      {selected.lat}, {selected.lng}
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>Прислано</td>
                    <td style={tdVal}>{timeAgo(selected.createdAt)}</td>
                  </tr>
                  {selected.comment && (
                    <tr>
                      <td style={tdLabel}>Комментарий</td>
                      <td style={tdVal}>{selected.comment}</td>
                    </tr>
                  )}
                  {selected.email && (
                    <tr>
                      <td style={tdLabel}>Email</td>
                      <td style={tdVal}>{selected.email}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => updateStatus(selected.id, "in_progress")} style={btnSecondary}>
                  В работу
                </button>
                <button onClick={() => updateStatus(selected.id, "resolved")} style={{ ...btnSecondary, color: "#16A34A" }}>
                  Устранён
                </button>
              </div>
              <button onClick={() => setSelected(null)} style={{ ...btnSecondary, width: "100%", marginTop: 8 }}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("citizen");
  const [reports, setReports] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    setReports(loadReports());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const seedDemo = () => {
    const demo = [
      {
        id: uid(),
        road: "Алматы - Хоргос",
        defectType: "Трещина в покрытии",
        comment: "",
        email: "",
        lat: 43.234,
        lng: 77.891,
        status: "in_progress",
        createdAt: Date.now() - 3600e3,
      },
      {
        id: uid(),
        road: "Астана - Павлодар",
        defectType: "Яма в покрытии",
        comment: "Крупная яма на правой полосе",
        email: "aigerim@example.com",
        lat: 51.112,
        lng: 75.55,
        status: "new",
        createdAt: Date.now() - 7200e3,
      },
      {
        id: uid(),
        road: "Алматы - Конаев",
        defectType: "Стёртая разметка",
        comment: "",
        email: "",
        lat: 43.6,
        lng: 77.4,
        status: "resolved",
        createdAt: Date.now() - 86400e3 * 2,
      },
      {
        id: uid(),
        road: "Шымкент - Тараз",
        defectType: "Повреждённый отбойник",
        comment: "После сильного дождя",
        email: "",
        lat: 42.9,
        lng: 69.6,
        status: "new",
        createdAt: Date.now() - 1800e3,
      },
    ];
    saveReports(demo);
    refresh();
  };

  const clearAll = () => {
    saveReports([]);
    refresh();
  };

  return (
    <div style={{ fontFamily: "var(--font-sans)", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setView("citizen")} style={{ ...tab, ...(view === "citizen" ? tabActive : {}) }}>
          Форма жителя
        </button>
        <button onClick={() => setView("dashboard")} style={{ ...tab, ...(view === "dashboard" ? tabActive : {}) }}>
          Панель КАЖ {reports.length > 0 ? `(${reports.length})` : ""}
        </button>
        <div style={{ flex: 1 }} />
        {view === "dashboard" && reports.length === 0 && (
          <button onClick={seedDemo} style={btnSecondary}>
            Заполнить демо-данными
          </button>
        )}
        {reports.length > 0 && (
          <button onClick={clearAll} style={{ ...iconToggle, color: "var(--text-muted)" }} title="Очистить все данные">
            <RotateCcw size={15} />
          </button>
        )}
      </div>

      {!loaded ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>Загрузка...</div>
      ) : view === "citizen" ? (
        <CitizenForm onSubmit={refresh} />
      ) : (
        <Dashboard reports={reports} refresh={refresh} />
      )}
    </div>
  );
}

const wrap = { maxWidth: 480, margin: "0 auto" };
const card = {
  background: "var(--surface-2, #fff)",
  border: "0.5px solid var(--border, #e5e7eb)",
  borderRadius: 12,
  padding: "1.25rem 1.5rem",
};
const input = {
  width: "100%",
  height: 38,
  padding: "0 10px",
  borderRadius: 8,
  border: "0.5px solid var(--border-strong, #d1d5db)",
  background: "var(--surface-1, #f9fafb)",
  fontSize: 14,
  color: "var(--text-primary)",
  boxSizing: "border-box",
};
const btnPrimary = {
  width: "100%",
  height: 42,
  borderRadius: 8,
  border: "none",
  background: "#EA580C",
  color: "#fff",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  marginTop: 6,
};
const btnSecondary = {
  height: 38,
  padding: "0 14px",
  borderRadius: 8,
  border: "0.5px solid var(--border-strong, #d1d5db)",
  background: "transparent",
  color: "var(--text-primary)",
  fontSize: 13.5,
  cursor: "pointer",
};
const iconToggle = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "0.5px solid var(--border, #e5e7eb)",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
const tab = {
  height: 36,
  padding: "0 16px",
  borderRadius: 8,
  border: "0.5px solid var(--border, #e5e7eb)",
  background: "transparent",
  color: "var(--text-secondary)",
  fontSize: 13.5,
  fontWeight: 500,
  cursor: "pointer",
};
const tabActive = {
  background: "var(--text-primary, #111827)",
  color: "var(--surface-2, #fff)",
  borderColor: "transparent",
};
const chip = {
  height: 30,
  padding: "0 12px",
  borderRadius: 999,
  border: "0.5px solid var(--border, #e5e7eb)",
  background: "transparent",
  color: "var(--text-secondary)",
  fontSize: 12.5,
  cursor: "pointer",
};
const chipActive = {
  background: "var(--text-primary, #111827)",
  color: "#fff",
  borderColor: "transparent",
};
const noteBox = { fontSize: 12.5, padding: "8px 10px", borderRadius: 8, marginBottom: 10 };
const tdLabel = { color: "var(--text-secondary)", padding: "4px 8px 4px 0", verticalAlign: "top", whiteSpace: "nowrap" };
const tdVal = { color: "var(--text-primary)", padding: "4px 0", fontWeight: 500 };
