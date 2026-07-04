import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Sales Arcaffo | Intelligence Co-pilot';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function og() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom right, #09090b, #000000)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '48px' }}>
          <div
            style={{
              background: '#ffffff',
              color: '#000000',
              width: '80px',
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '20px',
              fontSize: '48px',
              fontWeight: 900,
              fontFamily: 'sans-serif',
            }}
          >
            S
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#ffffff', fontSize: '48px', fontWeight: 800, fontFamily: 'sans-serif', letterSpacing: '-0.02em' }}>
              Sales Arcaffo
            </span>
            <span style={{ color: '#a1a1aa', fontSize: '24px', fontWeight: 500, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
              NOIR SYSTEM
            </span>
          </div>
        </div>

        <h1
          style={{
            color: '#ffffff',
            fontSize: '72px',
            fontWeight: 800,
            fontFamily: 'sans-serif',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            marginBottom: '24px',
            maxWidth: '900px',
          }}
        >
          O Assistente Definitivo de Negociações para WhatsApp.
        </h1>
        
        <p
          style={{
            color: '#a1a1aa',
            fontSize: '32px',
            fontWeight: 500,
            fontFamily: 'sans-serif',
            lineHeight: 1.4,
            maxWidth: '800px',
          }}
        >
          Acelere suas vendas, gerencie leads e escale seu negócio com nossa inteligência artificial co-pilot.
        </p>

        <div style={{ display: 'flex', marginTop: 'auto', gap: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px 24px', borderRadius: '100px', color: '#fff', fontSize: '24px' }}>
            Next.js App Router
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px 24px', borderRadius: '100px', color: '#fff', fontSize: '24px' }}>
            AI-Powered
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
