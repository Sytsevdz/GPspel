"use client";

import { useState } from "react";
import type { BonusQuestionType } from "@/lib/bonus-predictions";

type Props = { action: (data: FormData) => void; grandPrixId: string; initialType: BonusQuestionType; initialDriverId: string; initialPoints: number; drivers: Array<{id:string;name:string}> };
export function BonusQuestionForm({action, grandPrixId, initialType, initialDriverId, initialPoints, drivers}: Props) {
 const [type,setType]=useState<BonusQuestionType>(initialType);
 return <form action={action} className="predictions-form">
  <input type="hidden" name="grand_prix_id" value={grandPrixId}/>
  <label className="predictions-field"><span>Type bonusvraag</span><select name="question_type" value={type} onChange={e=>setType(e.target.value as BonusQuestionType)}><option value="driver_finish_position">Driver finish position</option><option value="fastest_lap_driver">Fastest lap driver</option></select></label>
  {type === "driver_finish_position" ? <label className="predictions-field"><span>Coureur</span><select name="subject_driver_id" defaultValue={initialDriverId} required><option value="">Kies coureur</option>{drivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label> : null}
  <label className="predictions-field"><span>Punten</span><input name="points" type="number" min="1" step="1" defaultValue={initialPoints} required/></label>
  <button type="submit">Bonusvraag opslaan</button>
 </form>;
}
