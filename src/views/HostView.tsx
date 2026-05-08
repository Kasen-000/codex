import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { NightAction, Player, Role, Room, Vote } from '../types';
import QRCode from 'qrcode';
import { AnimatePresence, motion } from 'framer-motion';
import { distributeRoles } from '../roleEngine';

const roleLabel: Record<Role, string> = {
  mafia: 'Mafia', doctor: 'Doctor', detective: 'Detective', gossip: 'Gossip', townie: 'Townie'
};

export function HostView() {
  const { roomCode = 'DEMO' } = useParams();
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomId, setRoomId] = useState<string>('');
  const [roomStatus, setRoomStatus] = useState<Room['status']>('waiting');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [starting, setStarting] = useState(false);
  const [obit, setObit] = useState<{name: string; role: Role} | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [timer, setTimer] = useState(120);
  const [executedId, setExecutedId] = useState<string | null>(null);

  const joinUrl = useMemo(() => `${window.location.origin}/join/${roomCode}`, [roomCode]);

  useEffect(() => { QRCode.toDataURL(joinUrl, { margin: 1, width: 320 }).then(setQrDataUrl); }, [joinUrl]);

  useEffect(() => {
    let mounted = true;
    const channels: Array<ReturnType<typeof supabase.channel>> = [];

    const hydrate = async () => {
      const { data: room } = await supabase.from('rooms').upsert({ code: roomCode, status: 'waiting' }, { onConflict: 'code' }).select('*').single();
      if (!room || !mounted) return;
      setRoomId(room.id);
      setRoomStatus(room.status);

      const syncPlayers = async () => {
        const { data } = await supabase.from('players').select('*').eq('room_id', room.id).order('joined_at');
        if (mounted && data) setPlayers(data as Player[]);
      };
      await syncPlayers();

      channels.push(
        supabase.channel(`room:${room.id}:players`).on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` }, syncPlayers).subscribe(),
        supabase.channel(`room:${room.id}:status`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (p) => setRoomStatus((p.new as Room).status)).subscribe(),
        supabase.channel(`room:${room.id}:votes`).on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `room_id=eq.${room.id}` }, async () => { const { count } = await supabase.from('votes').select('*', { count: 'exact', head: true }).eq('room_id', room.id); setVoteCount(count ?? 0); }).subscribe()
      );
    };
    void hydrate();
  
  const startTribunal = async () => {
    if (!roomId) return;
    setExecutedId(null);
    await supabase.from('votes').delete().eq('room_id', roomId);
    await supabase.from('rooms').update({ status: 'tribunal' }).eq('id', roomId);
  };

  const resolveTribunal = async () => {
    if (!roomId) return;
    const { data } = await supabase.from('votes').select('*').eq('room_id', roomId);
    const votes = (data ?? []) as Vote[];
    const tally = new Map<string, number>();
    votes.forEach((v) => tally.set(v.target_id, (tally.get(v.target_id) ?? 0) + 1));
    const winner = [...tally.entries()].sort((a,b)=>b[1]-a[1])[0];
    if (winner) {
      setExecutedId(winner[0]);
      await supabase.from('players').update({ is_alive: false }).eq('id', winner[0]);
    }

    const alive = players.filter((p) => p.is_alive && p.id !== winner?.[0]);
    const mafiaAlive = alive.filter((p) => p.role === 'mafia').length;
    const townAlive = alive.length - mafiaAlive;
    if (mafiaAlive === 0) await supabase.from('rooms').update({ status: 'town_win' }).eq('id', roomId);
    else if (mafiaAlive >= townAlive) await supabase.from('rooms').update({ status: 'mafia_win' }).eq('id', roomId);
    else await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
  };

  return () => { mounted = false; channels.forEach((c) => void supabase.removeChannel(c)); };
  }, [roomCode]);


  useEffect(() => {
    if (roomStatus !== 'tribunal') return;
    setTimer(120);
    const started = Date.now();
    const id = window.setInterval(() => {
      const left = Math.max(0, 120 - Math.floor((Date.now() - started) / 1000));
      setTimer(left);
      if (left <= 0) {
        clearInterval(id);
        void resolveTribunal();
      }
    }, 250);
  
  const startTribunal = async () => {
    if (!roomId) return;
    setExecutedId(null);
    await supabase.from('votes').delete().eq('room_id', roomId);
    await supabase.from('rooms').update({ status: 'tribunal' }).eq('id', roomId);
  };

  const resolveTribunal = async () => {
    if (!roomId) return;
    const { data } = await supabase.from('votes').select('*').eq('room_id', roomId);
    const votes = (data ?? []) as Vote[];
    const tally = new Map<string, number>();
    votes.forEach((v) => tally.set(v.target_id, (tally.get(v.target_id) ?? 0) + 1));
    const winner = [...tally.entries()].sort((a,b)=>b[1]-a[1])[0];
    if (winner) {
      setExecutedId(winner[0]);
      await supabase.from('players').update({ is_alive: false }).eq('id', winner[0]);
    }

    const alive = players.filter((p) => p.is_alive && p.id !== winner?.[0]);
    const mafiaAlive = alive.filter((p) => p.role === 'mafia').length;
    const townAlive = alive.length - mafiaAlive;
    if (mafiaAlive === 0) await supabase.from('rooms').update({ status: 'town_win' }).eq('id', roomId);
    else if (mafiaAlive >= townAlive) await supabase.from('rooms').update({ status: 'mafia_win' }).eq('id', roomId);
    else await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
  };

  return () => clearInterval(id);
  }, [roomStatus]);

  const startGame = async () => {
    if (!roomId || players.length < 4 || starting) return;
    setStarting(true);
    await supabase.from('rooms').update({ status: 'blackout' }).eq('id', roomId);
    const assignments = distributeRoles(players.map((p) => p.id));
    for (const a of assignments) await supabase.from('players').update({ role: a.role, is_alive: true }).eq('id', a.id);
    setTimeout(async () => {
      await supabase.from('rooms').update({ status: 'revealing' }).eq('id', roomId);
      setStarting(false);
    }, 2200);
  };

  const startNight = async () => {
    if (!roomId) return;
    setObit(null);
    await supabase.from('night_actions').delete().eq('room_id', roomId);
    await supabase.from('rooms').update({ status: 'night' }).eq('id', roomId);
  };

  const resolveNight = async () => {
    if (!roomId) return;
    const { data: actions } = await supabase.from('night_actions').select('*').eq('room_id', roomId);
    const typed = (actions ?? []) as NightAction[];
    const hitTargets = new Set(typed.filter((a) => a.action_type === 'hit').map((a) => a.target_id));
    const saveTargets = new Set(typed.filter((a) => a.action_type === 'save').map((a) => a.target_id));
    const doomed = [...hitTargets].find((id) => !saveTargets.has(id));

    if (doomed) {
      await supabase.from('players').update({ is_alive: false }).eq('id', doomed);
      const victim = players.find((p) => p.id === doomed);
      if (victim?.role) setObit({ name: victim.nickname, role: victim.role });
    } else {
      setObit({ name: 'NO ONE', role: 'townie' });
    }

    await supabase.from('rooms').update({ status: 'press' }).eq('id', roomId);
  };


  const startTribunal = async () => {
    if (!roomId) return;
    setExecutedId(null);
    await supabase.from('votes').delete().eq('room_id', roomId);
    await supabase.from('rooms').update({ status: 'tribunal' }).eq('id', roomId);
  };

  const resolveTribunal = async () => {
    if (!roomId) return;
    const { data } = await supabase.from('votes').select('*').eq('room_id', roomId);
    const votes = (data ?? []) as Vote[];
    const tally = new Map<string, number>();
    votes.forEach((v) => tally.set(v.target_id, (tally.get(v.target_id) ?? 0) + 1));
    const winner = [...tally.entries()].sort((a,b)=>b[1]-a[1])[0];
    if (winner) {
      setExecutedId(winner[0]);
      await supabase.from('players').update({ is_alive: false }).eq('id', winner[0]);
    }

    const alive = players.filter((p) => p.is_alive && p.id !== winner?.[0]);
    const mafiaAlive = alive.filter((p) => p.role === 'mafia').length;
    const townAlive = alive.length - mafiaAlive;
    if (mafiaAlive === 0) await supabase.from('rooms').update({ status: 'town_win' }).eq('id', roomId);
    else if (mafiaAlive >= townAlive) await supabase.from('rooms').update({ status: 'mafia_win' }).eq('id', roomId);
    else await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
  };

  return (
    <main className={`host-layout status-${roomStatus}`} style={roomStatus==='tribunal'?{'--panic': String((120-timer)/120)} as React.CSSProperties:undefined}>
      {roomStatus === 'blackout' && <div className="blackout-overlay" aria-hidden="true"><div className="thrum" /></div>}
      {roomStatus === 'night' && <div className="night-overlay"><h2>THE TOWN IS ASLEEP</h2><div className="spotlight" /></div>}
      {roomStatus === 'tribunal' && <div className='tribunal-overlay'><div className='countdown'>{timer}</div><div className='vote-cast'>🗳️ Vote Cast: {voteCount}</div></div>}
      {roomStatus === 'press' && (
        <div className="gazette-wrap">
          <div className={`gazette ${obit ? 'stop' : ''}`}>
            <h3>GOTHAM GAZETTE</h3>
            <p className="headline">{obit ? `TRAGEDY STRIKES: ${obit.name} ELIMINATED` : 'MIDNIGHT SPECIAL'}</p>
            {obit && <div className="obit">OBITUARY: {obit.name} — {roleLabel[obit.role]} ({obit.role})</div>}
          </div>
        </div>
      )}
      <section className="left-panel">
        <h1>MAFIA</h1>
        {qrDataUrl && <img src={qrDataUrl} alt="Join QR code" className="qr" />}
        <p>Scan to Join</p>
        <code>{joinUrl}</code>
        <button className="start-btn" onClick={startGame} disabled={starting || players.length < 4}>{starting ? 'Distributing...' : 'Start Game'}</button>
        <button className="start-btn" onClick={startNight} disabled={roomStatus !== 'revealing' && roomStatus !== 'in_game'}>Start Night</button>
        <button className="start-btn" onClick={resolveNight} disabled={roomStatus !== 'night'}>Print Morning Edition</button>
        <button className="start-btn" onClick={startTribunal} disabled={roomStatus !== 'in_game' && roomStatus !== 'press'}>Open Tribunal</button>
        <button className="start-btn" onClick={resolveTribunal} disabled={roomStatus !== 'tribunal'}>Reveal Verdict</button>
      </section>
      <section className="right-panel"><div className="player-grid"><AnimatePresence>{players.map((player) => (
        <motion.article key={player.id} className={`player-card ${!player.is_alive ? 'dead' : ''} ${executedId===player.id?'executed':''}`} initial={{ opacity: 0, scale: 0.75, y: 28 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ type: 'spring', stiffness: 460, damping: 28 }}><span>{player.nickname}</span>{executedId===player.id && <em className='stamp'>ELIMINATED</em>}</motion.article>
      ))}</AnimatePresence></div></section>
      {roomStatus === 'mafia_win' && <div className='win-screen mafia'><div className='split-logo'><span>MAFIA</span><span>WINS</span></div></div>}
      {roomStatus === 'town_win' && <div className='win-screen town'><div className='sunrise' /><h2>TOWN WINS</h2></div>}
    </main>
  );
}
