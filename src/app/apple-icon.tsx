import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom right, #111111, #000000)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '4px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '25%',
            width: 120,
            height: 120,
          }}
        >
          <span style={{ fontSize: 80, fontWeight: 900, fontFamily: 'sans-serif' }}>S</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
