import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavigationProgress } from "@/components/NavigationProgress";
import { PwaInstallBanner } from "@/components/PwaInstall";
import { AlertProvider } from "@/lib/alert";
import { AuthProvider } from "@/lib/auth";
import { SocketProvider } from "@/lib/socket";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Catetrek — Pencatatan Keuangan Usaha",
  description: "Aplikasi keuangan realtime untuk usaha kecil",
  applicationName: "Catetrek",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Catetrek",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b5f56",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeBootScript = `(function(){try{var r=document.documentElement;var t=localStorage.getItem('catetrek_theme');var dark=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);r.classList.toggle('dark',dark);r.style.colorScheme=dark?'dark':'light';var hex=localStorage.getItem('catetrek_brand')||'#0b5f56';var m=String(hex).trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);if(!m)return;var h=m[1];if(h.length===3)h=h.split('').map(function(c){return c+c}).join('');hex='#'+h.toLowerCase();function hexToRgb(x){var n=parseInt(x.slice(1),16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255};}function rgbToHsl(R,G,B){R/=255;G/=255;B/=255;var max=Math.max(R,G,B),min=Math.min(R,G,B),l=(max+min)/2,s=0,h=0;if(max!==min){var d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);if(max===R)h=((G-B)/d+(G<B?6:0))/6;else if(max===G)h=((B-R)/d+2)/6;else h=((R-G)/d+4)/6;}return{h:h*360,s:s,l:l};}function hslToRgb(h,s,l){h=((h%360)+360)%360;s=Math.min(1,Math.max(0,s));l=Math.min(1,Math.max(0,l));if(s===0){var v=l*255;return{r:v,g:v,b:v};}function f(p,q,t){if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;}var q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q,hk=h/360;return{r:f(p,q,hk+1/3)*255,g:f(p,q,hk)*255,b:f(p,q,hk-1/3)*255};}function hslHex(h,s,l){var c=hslToRgb(h,s,l);function t(v){return Math.round(Math.min(255,Math.max(0,v))).toString(16).padStart(2,'0');}return '#'+t(c.r)+t(c.g)+t(c.b);}var rgb=hexToRgb(hex);var hsl=rgbToHsl(rgb.r,rgb.g,rgb.b);var sat=Math.min(0.72,Math.max(0.25,hsl.s));var ah=(hsl.h+38)%360;var tokens=dark?{brand:hslHex(hsl.h,Math.min(0.78,sat+0.12),0.64),deep:hslHex(hsl.h,sat,0.5),mid:hslHex(hsl.h,Math.min(0.72,sat+0.08),0.58),soft:hslHex(hsl.h,0.32,0.15),accent:hslHex(ah,0.72,0.64),accentSoft:hslHex(ah,0.35,0.14),sidebar:hslHex(hsl.h,Math.min(0.58,Math.max(0.32,sat)),0.07),glow:hslHex(hsl.h,sat,0.38),bg:hslHex(hsl.h,0.3,0.07),bgElevated:hslHex(hsl.h,0.26,0.12),ink:hslHex(hsl.h,0.14,0.93),muted:hslHex(hsl.h,0.18,0.68),line:hslHex(hsl.h,0.24,0.2),overlay:'rgba(0,0,0,0.55)'}:{brand:hslHex(hsl.h,sat,Math.min(0.32,Math.max(0.18,hsl.l))),deep:hslHex(hsl.h,sat,0.14),mid:hslHex(hsl.h,Math.min(0.65,Math.max(0.25,sat-0.05)),0.38),soft:hslHex(hsl.h,0.32,0.91),accent:hslHex(ah,0.68,0.52),accentSoft:hslHex(ah,0.55,0.93),sidebar:hslHex(hsl.h,Math.min(0.65,Math.max(0.35,sat+0.05)),0.12),glow:hslHex(hsl.h,sat,0.36),bg:hslHex(hsl.h,0.22,0.94),bgElevated:'#ffffff',ink:hslHex(hsl.h,Math.min(0.4,Math.max(0.2,sat*0.8)),0.12),muted:hslHex(hsl.h,0.12,0.38),line:hslHex(hsl.h,0.18,0.82),overlay:'rgba('+Math.round(rgb.r*0.35)+','+Math.round(rgb.g*0.28)+','+Math.round(rgb.b*0.25)+',0.45)'};r.style.setProperty('--brand',tokens.brand);r.style.setProperty('--brand-deep',tokens.deep);r.style.setProperty('--brand-mid',tokens.mid);r.style.setProperty('--brand-soft',tokens.soft);r.style.setProperty('--accent',tokens.accent);r.style.setProperty('--accent-soft',tokens.accentSoft);r.style.setProperty('--sidebar',tokens.sidebar);r.style.setProperty('--sidebar-glow',tokens.glow);r.style.setProperty('--bg',tokens.bg);r.style.setProperty('--bg-elevated',tokens.bgElevated);r.style.setProperty('--ink',tokens.ink);r.style.setProperty('--muted',tokens.muted);r.style.setProperty('--line',tokens.line);r.style.setProperty('--overlay',tokens.overlay);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ThemeProvider>
          <NavigationProgress />
          <AlertProvider>
            <AuthProvider>
              <SocketProvider>
                {children}
                <PwaInstallBanner />
              </SocketProvider>
            </AuthProvider>
          </AlertProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
