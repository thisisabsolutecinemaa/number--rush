import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

declare global { interface Window { Telegram?: any } }
const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();

type Tab = 'spin' | 'collection' | 'rating' | 'profile';

function App() {
  const [balance,setBalance] = React.useState<number>(100000);
  const [result,setResult] = React.useState<any>(null);
  const [busy,setBusy] = React.useState(false);
  const [error,setError] = React.useState('');
  const [tab,setTab] = React.useState<Tab>('spin');
  const [country,setCountry] = React.useState('UA');
  const initData = tg?.initData || '';
  const plates: Record<string,{flag:string;sample:string;label:string}> = {
    UA:{flag:'🇺🇦',sample:'AA 0000 XX',label:'УКРАИНА'},
    CN:{flag:'🇨🇳',sample:'京 A·88888',label:'КИТАЙ'},
    RU:{flag:'🇷🇺',sample:'А 000 АА 77',label:'РОССИЯ'},
    EU:{flag:'🇪🇺',sample:'AB · 123 · CD',label:'ЕВРОПА'}
  };

  async function spin() {
    setBusy(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/spin`, {
        method:'POST', headers:{'X-Telegram-Init-Data':initData}
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Ошибка прокрутки');
      setResult(data); setBalance(data.balance); tg?.HapticFeedback?.notificationOccurred('success');
    } catch(e:any) { setError(e.message || 'Не удалось связаться с сервером'); }
    finally { setBusy(false); }
  }

  const nav: {id:Tab;icon:string;label:string}[] = [
    {id:'spin',icon:'🎰',label:'Крутка'},
    {id:'collection',icon:'🎒',label:'Коллекция'},
    {id:'rating',icon:'🏆',label:'Рейтинг'},
    {id:'profile',icon:'👤',label:'Профиль'}
  ];

  return <main>
    <header><div className="mark">NR</div><div><b>NUMBER RUSH</b><small>PLATE COLLECTION</small></div><span className="avatar">🚘</span></header>
    <section className="wallet"><small>ВАШ БАЛАНС</small><strong>{balance.toLocaleString('ru-RU')} ₽</strong><span>Игровые рубли <i className="online-dot"/> <em>ONLINE</em></span></section>

    {tab === 'spin' && <section className="hero">
      <div className="eyebrow">COLLECT • UPGRADE • TRADE</div>
      <h1>Открой свой<br/>номер.</h1>
      <p>Собирай коллекцию автомобильных номеров со всего мира.</p>
      <div className="country-select" aria-label="Выбрать страну">
        {Object.entries(plates).map(([code,p])=><button key={code} className={country===code?'country active':'country'} onClick={()=>setCountry(code)}>{p.flag} {code}</button>)}
      </div>
      <div className={`plate plate-${country.toLowerCase()}`}>
        <span className="plate-flag">{plates[country].flag}</span>
        <b>{plates[country].sample}</b>
        <i>{country}</i>
        <span className="screw screw-a"/><span className="screw screw-b"/>
      </div>
      <div className="plate-caption">{plates[country].label} · ОБРАЗЕЦ ФОРМАТА</div>
      <button className="spin-button" disabled={busy} onClick={spin}>{busy?'ОТКРЫВАЕМ...':'ПРОКРУТИТЬ · 5 000 ₽'}</button>
      <small className="muted">10 прокруток — 50 000 ₽</small>
      {error && <p className="error">{error}</p>}
      {result && <div className="drop"><small>ВАШ ВЫПАВШИЙ НОМЕР</small><h2>{result.code}</h2><b>{result.rarity}</b><p>{result.region} · {result.category}</p></div>}
      <div className="feature-row"><span>✨ Реалистичный вид</span><span>🌍 Весь мир</span><span>💎 Редкости</span></div>
    </section>}

    {tab === 'collection' && <section className="page-panel"><div className="eyebrow">MY GARAGE</div><h1>Моя коллекция</h1><p>Все найденные номера будут собираться здесь.</p><div className="empty-state"><div>🏁</div><b>Гараж ждёт первый номер</b><small>Открой номер в разделе «Крутка», и он появится здесь.</small><button onClick={()=>setTab('spin')}>ОТКРЫТЬ НОМЕР</button></div><div className="stats-grid"><div><b>0</b><small>НОМЕРОВ</small></div><div><b>0</b><small>РЕДКИХ</small></div><div><b>0</b><small>СТРАН</small></div></div></section>}

    {tab === 'rating' && <section className="page-panel"><div className="eyebrow">TOP COLLECTORS</div><h1>Рейтинг</h1><p>Соревнование коллекционеров NUMBER RUSH.</p><div className="empty-state"><div>🏆</div><b>Таблица лидеров готовится</b><small>Рейтинг появится после подключения серверной таблицы игроков.</small></div></section>}

    {tab === 'profile' && <section className="page-panel"><div className="eyebrow">PLAYER CARD</div><h1>Профиль</h1><div className="profile-card"><div className="profile-avatar">🚘</div><b>{tg?.initDataUnsafe?.user?.first_name || 'Коллекционер'}</b><small>НОВИЧОК · NUMBER RUSH</small><div className="profile-line"><span>Баланс</span><b>{balance.toLocaleString('ru-RU')} ₽</b></div><div className="profile-line"><span>Статус</span><b>Участник</b></div></div></section>}

    <nav>{nav.map(item=><button key={item.id} className={tab===item.id?'nav-item selected':'nav-item'} onClick={()=>setTab(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>
  </main>
}
createRoot(document.getElementById('root')!).render(<App/>);
