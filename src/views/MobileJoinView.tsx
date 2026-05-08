import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { Player, Role, Room } from '../types';

const roleMeta: Record<Role, { icon: string; label: string; theme: string }> = {
  mafia: { icon: '🕷️', label: 'Mafia', theme: 'role-mafia' },
  doctor: { icon: '💉', label: 'Doctor', theme: 'role-townie' },
  detective: { icon: '🕵️', label: 'Detective', theme: 'role-townie' },
  gossip: { icon: '🗣️', label: 'Gossip', theme: 'role-townie' },
  townie: { icon: '🧑', label: 'Townie', theme: 'role-townie' }
};

export function MobileJoinView() {
  const { roomCode = 'DEMO' } = useParams();
  const [nickname, setNickname] = useState('');
  const [status, setStatus] = useState('');
  const [player, setPlayer] = useState<Player | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [alivePlayers, setAlivePlayers] = useState<Player[]>([]);

  useEffect(() => {
    if (!room) return;
    const roomChannel = supabase.channel(`room:${room.id}:mobile`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (p) => setRoom(p.new as Room)).subscribe();
    const playersChannel = supabase.channel(`room:${room.id}:mobile:players`).on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` }, async () => {
      const { data } = await supabase.from('players').select('*').eq('room_id', room.id).eq('is_alive', true).order('joined_at');
      if (data) setAlivePlayers(data as Player[]);
    }).subscribe();
    return () => { void supabase.removeChannel(roomChannel); void supabase.removeChannel(playersChannel); };
  }, [room]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = nickname.trim();
    if (!name) return;

    const { data: joinedRoom } = await supabase.from('rooms').upsert({ code: roomCode, status: 'waiting' }, { onConflict: 'code' }).select('*').single();
    if (!joinedRoom) return setStatus('Room unavailable.');

    const { data } = await supabase.from('players').insert({ room_id: joinedRoom.id, nickname: name }).select('*').single();
    if (!data) return setStatus('Join failed.');

    setPlayer(data as Player);
    setRoom(joinedRoom as Room);
    setStatus(`You're in, ${name}.`);
    setNickname('');

    const { data: alive } = await supabase.from('players').select('*').eq('room_id', joinedRoom.id).eq('is_alive', true).order('joined_at');
    if (alive) setAlivePlayers(alive as Player[]);
  };

  const castVote = async (targetId: string) => {
    if (!player || !room) return;
    await supabase.from('votes').upsert({ room_id: room.id, voter_id: player.id, target_id: targetId }, { onConflict: 'room_id,voter_id' });
    setStatus('Vote Cast');
  };

  const chooseTarget = async (targetId: string, actionType: 'hit' | 'save') => {
    if (!player || !room) return;
    await supabase.from('night_actions').insert({ room_id: room.id, actor_id: player.id, target_id: targetId, action_type: actionType });
    setStatus(`Action locked: ${actionType.toUpperCase()}`);
  };

  const onLongPressStart = () => {
    if (room?.status !== 'revealing' || !player?.role) return;
    window.setTimeout(() => {
      setRevealed(true);
      if (navigator.vibrate) navigator.vibrate([120, 60, 160]);
    }, 700);
  };

  const isMafia = player?.role === 'mafia';
  const isDoctor = player?.role === 'doctor';

  return (
    <main className="mobile-layout">
      <h1>Join MAFIA</h1>
      {!player && <form onSubmit={onSubmit}><input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Nickname" maxLength={20} required /><button type="submit">Join Lobby</button></form>}

      {player && <div className={`glossy-card ${revealed && player.role ? roleMeta[player.role].theme : ''}`} onPointerDown={onLongPressStart} onTouchStart={onLongPressStart}>
        {!revealed || !player.role ? <><strong>Secret Role</strong><p>Long-press to reveal when blackout ends.</p></> : <><span className="role-icon">{roleMeta[player.role].icon}</span><strong>{roleMeta[player.role].label}</strong></>}
      </div>}

      {room?.status === 'night' && revealed && isMafia && <section className="action-panel"><h3>Hit List</h3>{alivePlayers.filter((p) => p.id !== player?.id).map((p) => <button key={p.id} onClick={() => chooseTarget(p.id, 'hit')}>{p.nickname}</button>)}</section>}
      {room?.status === 'night' && revealed && isDoctor && <section className="action-panel"><h3>Save List</h3>{alivePlayers.map((p) => <button key={p.id} onClick={() => chooseTarget(p.id, 'save')}>{p.nickname}</button>)}</section>}
      {room?.status === 'tribunal' && <section className='action-panel'><h3>Vote for Elimination</h3><div className='vote-grid'>{alivePlayers.filter((p)=>p.id!==player?.id).map((p)=><button key={p.id} onClick={()=>castVote(p.id)}>{p.nickname}</button>)}</div></section>}

      <small>{status}</small>
    </main>
  );
}
