import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

declare global { interface Window { Telegram?: any } }
const tg = window.Telegram?.WebApp;
const API_URL = import.meta.env.VITE_API_URL || 'https://number-rush-api-1ywd.onrender.com';
tg?.ready(); tg?.expand();

type Tab = 'spin' | 'collection' | 'rating' | 'profile';
const plates: Record<string,{flag:string;sample:string;label:string;sub:string}> = {
  UA:{flag:'🇺🇦',sample:'AA 0000 XX',label:'УКРАИНА',sub:'EUROPEAN STANDARD'},
  CN:{flag:'🇨🇳',sample:'京 A·88888',label:'КИТАЙ',sub:'MAINLAND CHINA'},
  RU:{flag:'🇷🇺',sample:'А 000 АА 77',label:'РОССИЯ',sub:'RUSSIAN FEDERATION'},
  EU:{flag:'🇪🇺',sample:'AB · 123 · CD',label:'ЕВРОПА',sub:'EUROPEAN UNION'}
};

function App() {
  const [balance,setBalance]=React.useState(100000);
  const [result,setResult]=React.useState<any>(null);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState('');
  const [tab,setTab]=React.useState<Tab>('spin');
  const [country,setCountry]=React.useState('UA');
  const initData=tg?.initData || '';

  async function spin() {
    if (busy) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const res=await fetch(`${API_URL}/api/spin`,{method:'POST',headers:{'X-Telegram-Init-Data':initData}});
      const raw=await res.text();
      let data:any;
      try { data=JSON.parse(raw); } catch { throw new Error('Сервер вернул некорректный ответ. Попробуй ещё раз.'); }
      if (!res.ok) throw new Error(data.detail || 'Не удалось открыть номер');
      setResult(data); setBalance(data.balance); tg?.HapticFeedback?.notificationOccurred('success');
    } catch(e:any) { setError(e.message || 'Нет соединения с сервером'); }
    finally { setBusy(false); }
  }

  const nav:{id:Tab;icon:string;label:string}[]=[
    {id:'spin',icon:'◈',label:'Крутка'},
    {id:'collection',icon:'▤',label:'Гараж'},
    {id:'rating',icon:'↗',label:'Рейтинг'},
    {id:'profile',icon:'◉',label:'Профиль'}
  ];

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-mark">NR<span>.</span></div>
      <div className="brand-copy"><b>NUMBER RUSH</b><small>PRIVATE PLATE CLUB</small></div>
      <div className="live-status"><i/> LIVE</div>
    </header>

    <section className="balance-panel">
      <div><span className="section-kicker">ВАШ СЧЁТ</span><strong>{balance.toLocaleString('ru-RU')} <small>₽</small></strong></div>
      <div className="balance-side"><span>ИГРОВОЙ БАЛАНС</span><b>NR WALLET</b></div>
    </section>

    {tab==='spin' && <section className="spin-view">
      <div className="intro">
        <span className="section-kicker">COLLECT · UPGRADE · TRADE</span>
        <h1>Твой номер.<br/><em>Твоя история.</em></h1>
        <p>Коллекционируй автомобильные номера со всего мира. От редких комбинаций до настоящих легенд.</p>
      </div>

      <div className="selector-head"><span>РЕГИОН НОМЕРА</span><span>01 — 04</span></div>
      <div className="country-select">
        {Object.entries(plates).map(([code,p])=><button key={code} className={country===code?'country active':'country'} onClick={()=>setCountry(code)}><span>{p.flag}</span>{code}</button>)}
      </div>

      <div className="plate-stage">
        <div className={`plate plate-${country.toLowerCase()}`}>
          <div className="plate-band"><span>{plates[country].flag}</span><small>{country}</small></div>
          <b>{plates[country].sample}</b>
          <div className="plate-screw screw-left"/><div className="plate-screw screw-right"/>
        </div>
        <div className="plate-meta"><span>{plates[country].label}</span><span>{plates[country].sub}</span></div>
      </div>

      <div className="rarity-strip"><span><i className="rarity-dot common"/> COMMON</span><span><i className="rarity-dot rare"/> RARE</span><span><i className="rarity-dot epic"/> EPIC+</span><span className="pool-label">ПУЛ ОБНОВЛЁН</span></div>

      <button className="spin-button" disabled={busy} onClick={spin}>
        <span>{busy?'ИДЁТ ОТКРЫТИЕ':'ОТКРЫТЬ НОМЕР'}</span><b>{busy?'…':'5 000 ₽'}</b>
      </button>
      <div className="spin-foot"><span>10 ОТКРЫТИЙ — 50 000 ₽</span><span>СЛУЧАЙНАЯ РЕДКОСТЬ</span></div>

      {error && <div className="notice error">{error}</div>}
      {result && <div className="result-card"><span className="section-kicker">НОВОЕ ПОПОЛНЕНИЕ ГАРАЖА</span><h2>{result.code}</h2><div><b>{result.rarity}</b><span>{result.region} · {result.category}</span></div></div>}

      <div className="bottom-note"><span>01 / 04</span><p>Каждый номер — часть твоей истории.</p><span>NR CLUB</span></div>
    </section>}

    {tab==='collection' && <section className="page-view"><span className="section-kicker">YOUR PRIVATE GARAGE</span><h1>Твоя<br/><em>коллекция.</em></h1><div className="empty-state"><span className="empty-symbol">▤</span><b>Гараж пока пуст</b><p>Открой первый номер — он появится здесь.</p><button onClick={()=>setTab('spin')}>НАЙТИ ПЕРВЫЙ НОМЕР ↗</button></div></section>}
    {tab==='rating' && <section className="page-view"><span className="section-kicker">THE LEADERBOARD</span><h1>Таблица<br/><em>лидеров.</em></h1><div className="empty-state"><span className="empty-symbol">↗</span><b>Рейтинг скоро откроется</b><p>Собираем данные коллекционеров для первой таблицы.</p></div></section>}
    {tab==='profile' && <section className="page-view"><span className="section-kicker">MEMBER ID · NR CLUB</span><h1>Твой<br/><em>профиль.</em></h1><div className="member-card"><div className="member-avatar">NR</div><b>{tg?.initDataUnsafe?.user?.first_name || 'Коллекционер'}</b><span>FOUNDING MEMBER</span><div className="member-balance"><small>БАЛАНС</small><strong>{balance.toLocaleString('ru-RU')} ₽</strong></div></div></section>}

    <nav className="bottom-nav">{nav.map(item=><button key={item.id} className={tab===item.id?'nav-item selected':'nav-item'} onClick={()=>setTab(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>
  </main>
}
createRoot(document.getElementById('root')!).render(<App/>);
