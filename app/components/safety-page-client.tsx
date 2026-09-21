"use client";

import { useState } from "react";
import SafetySettings from "./safety-settings";

export default function SafetyPageClient(){const [notice,setNotice]=useState("");return <main className="route-page">{notice?<p className="route-notice" role="status">{notice}</p>:null}<SafetySettings onBack={()=>window.location.assign("/settings")} onNotice={setNotice}/></main>}
