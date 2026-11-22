import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

declare global { interface Window { Telegram?: any } }
const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();

function App() {
  const [balance,setBalance] = React.useState<number>(100000);
  const [result,setResult] = React.useState<any>(null);
  const [busy,setBusy] = React.useState(false);
  const [error,setError] = React.useState('');
  const initData = tg?.initData || '';

  async function spin() {
    setBusy(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/spin`, {
        method:'POST', headers:{'X-Telegram-Init-Data':initData}
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Ошибка прокрутки');
      setResult(data); setBalance(data.balance); tg?.HapticFeedback?.notificationOccurred('success');
    } catch(e:any) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <main>
    <header><div className="mark">NR</div><div><b>NUMBER RUSH</b><small>PLATE COLLECTION</small></div><span className="avatar">🚘</span></header>
    <section className="wallet"><small>ВАШ БАЛАНС</small><strong>{balance.toLocaleString('ru-RU')} ₽</strong><span>Игровые рубли</span></section>
    <section className="hero">
      <div className="eyebrow">COLLECT • UPGRADE • TRADE</div>
      <h1>Открой свой<br/>номер.</h1>
      <p>Собирай коллекцию автомобильных номеров со всего мира.</p>
      <div className="plate"><span>🇺🇦</span><b>AA 0000 XX</b><i>UA</i></div>
      <button disabled={busy} onClick={spin}>{busy?'ОТКРЫВАЕМ...':'ПРОКРУТИТЬ · 5 000 ₽'}</button>
      <small className="muted">10 прокруток — 50 000 ₽</small>
      {error && <p className="error">{error}</p>}
      {result && <div className="drop"><small>ВАШ ВЫПАВШИЙ НОМЕР</small><h2>{result.code}</h2><b>{result.rarity}</b><p>{result.region} · {result.category}</p></div>}
    </section>
    <nav><span>🎰<small>Крутка</small></span><span>🎒<small>Коллекция</small></span><span>🏆<small>Рейтинг</small></span><span>👤<small>Профиль</small></span></nav>
  </main>
}
createRoot(document.getElementById('root')!).render(<App/>);
