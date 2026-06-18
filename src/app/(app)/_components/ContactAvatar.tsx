"use client";

import React, { useState, useEffect } from "react";

export function isWhatsAppUrlExpired(url?: string | null): boolean {
  if (!url) return true;
  
  const isWaCdn = url.includes("pps.whatsapp.net") || url.includes("fbcdn.net");
  if (!isWaCdn) {
    return false;
  }

  try {
    let parseUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      parseUrl = "https://" + url.replace(/^\/+/, "");
    }
    
    const urlObj = new URL(parseUrl);
    const oe = urlObj.searchParams.get("oe");
    if (!oe) return false;

    const expirySec = parseInt(oe, 16);
    if (isNaN(expirySec)) return false;

    const nowSec = Math.floor(Date.now() / 1000);
    return nowSec >= expirySec;
  } catch {
    return false;
  }
}

export function ContactAvatar({ 
  src, 
  name, 
  fallback, 
  className 
}: { 
  src?: string | null; 
  name: string; 
  fallback: React.ReactNode; 
  className?: string 
}) {
  const [error, setError] = useState(false);
  
  useEffect(() => {
    setError(false);
  }, [src]);

  const isExpired = React.useMemo(() => isWhatsAppUrlExpired(src), [src]);

  if (src && !isExpired && !error) {
    return (
      <img 
        src={src} 
        alt={name} 
        className={className} 
        onError={() => setError(true)} 
      />
    );
  }
  return <>{fallback}</>;
}
