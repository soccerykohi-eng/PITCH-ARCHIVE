"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SafetySettings from "./safety-settings";

export default function SafetyPageClient(){const router=useRouter();const [notice,setNotice]=useState("");return <main className="route-page">{notice?<p className="route-notice" role="status">{notice}</p>:null}<SafetySettings onBack={()=>router.push("/settings")} onNotice={setNotice}/></main>}
