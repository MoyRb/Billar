# Billar SaaS (Base Inicial)

Base SaaS multi-tenant para administración de billares construida con Next.js App Router, TypeScript, Tailwind y Supabase.

## Requisitos
- Node.js 20+
- npm 10+
- Proyecto Supabase

## Instalación
```bash
npm install
```

## Configuración de Supabase
1. Copia variables de entorno:
```bash
cp .env.example .env.local
```
2. Completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Migraciones
Este repositorio incluye la migración inicial en `supabase/migrations/20260429_initial_schema.sql`.

Para aplicar:
```bash
supabase db push
```

## Desarrollo local
```bash
npm run dev
```

## Calidad
```bash
npm run lint
npm run build
```

## Deploy en Vercel
1. Importa el repo en Vercel.
2. Configura las variables de entorno de Supabase.
3. Deploy automático con `next build`.

## Arquitectura multi-tenant
- Todas las tablas de negocio usan `organization_id`.
- `organization_members` conecta usuarios con organizaciones.
- RLS habilitado para aislamiento de datos por organización.
- Trigger `bootstrap_new_user` crea organización, perfil, membresía owner y settings al registrarse.

## Módulos iniciales
Rutas protegidas:
- `/dashboard`
- `/mesas`
- `/ventas`
- `/productos`
- `/inventario`
- `/caja`
- `/clientes`
- `/reservaciones`
- `/reportes`
- `/configuracion`
