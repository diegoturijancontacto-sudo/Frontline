import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 1. Obtener el User-Agent del navegador del usuario
  const ua = request.headers.get('user-agent') || '';
  
  // 2. Definir una expresión regular simple para detectar dispositivos móviles
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  // 3. Lógica de redirección/reescritura
  // Si es móvil y NO está ya en la ruta /movil, lo enviamos allí
  if (isMobile && !request.nextUrl.pathname.startsWith('/movil')) {
    const url = request.nextUrl.clone();
    url.pathname = `/movil${url.pathname === '/' ? '' : url.pathname}`;
    
    // 'rewrite' mantiene la URL original en el navegador (mejor para SEO)
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

// 4. Configurar en qué rutas se ejecuta
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
