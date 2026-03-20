import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Photo {
  id: string;
  url: string;
  description: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  history: string;
  notes: string;
  photos: Photo[];
  coverPhotoUrl?: string;
}

export interface Connection {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export const INITIAL_FAMILIES: Record<string, FamilyMember> = {
  alejandro: {
    id: 'alejandro',
    name: 'Alejandro',
    role: 'Patriarca / Fotógrafo',
    history: 'El guardián de la memoria visual.',
    notes: 'Inició el archivo en 1972.',
    photos: [],
    coverPhotoUrl: ''
  },
  paula: {
    id: 'paula',
    name: 'Paula',
    role: 'Hija mayor',
    history: 'Continuadora del legado.',
    notes: 'Organizó la primera exposición.',
    photos: [],
    coverPhotoUrl: ''
  },
  nacho: {
    id: 'nacho',
    name: 'Nacho',
    role: 'El primo lejano',
    history: 'Viajero incansable.',
    notes: 'Aporta fotos de sus viajes.',
    photos: [],
    coverPhotoUrl: ''
  },
  moni: {
    id: 'moni',
    name: 'Moni',
    role: 'La tía artista',
    history: 'Pintora y escultora.',
    notes: 'Sus diarios son parte del archivo.',
    photos: [],
    coverPhotoUrl: ''
  },
  ander: {
    id: 'ander',
    name: 'Ander',
    role: 'El nieto menor',
    history: 'La nueva generación.',
    notes: 'Digitalizando el archivo.',
    photos: [],
    coverPhotoUrl: ''
  },
  familia_grande: {
    id: 'familia_grande',
    name: 'Familia Grande',
    role: 'Álbum Colectivo',
    history: 'Fotos de reuniones masivas.',
    notes: 'El corazón del archivo.',
    photos: [],
    coverPhotoUrl: ''
  },
  observador: {
    id: 'observador',
    name: 'OBSERVADOR',
    role: 'Testigo Externo',
    history: 'Aquel que mira desde fuera.',
    notes: 'La mirada objetiva.',
    photos: [],
    coverPhotoUrl: ''
  },
  oscar: {
    id: 'oscar',
    name: 'Óscar',
    role: 'Familia española',
    history: 'Clase media madrileña.',
    notes: 'Vínculo central en el grupo de Madrid.',
    photos: [],
    coverPhotoUrl: ''
  },
  inaki: {
    id: 'inaki',
    name: 'Iñaki',
    role: 'Familia de origen vasco',
    history: '(Bilbao). Primo de Óscar.',
    notes: 'Origen en Bilbao.',
    photos: [],
    coverPhotoUrl: ''
  },
  linxia: {
    id: 'linxia',
    name: 'Lin Xia',
    role: 'Origen chino',
    history: 'Adoptado en España.',
    notes: 'Vínculo fraternal con Iñaki.',
    photos: [],
    coverPhotoUrl: ''
  },
  alex: {
    id: 'alex',
    name: 'Alex',
    role: 'Familia científica',
    history: 'Orientada a la investigación.',
    notes: 'Científico del grupo.',
    photos: [],
    coverPhotoUrl: ''
  },
  carmen: {
    id: 'carmen',
    name: 'Carmen',
    role: 'Familia andaluza',
    history: 'Con raíces colombianas.',
    notes: 'Vínculo a través de la residencia en Madrid.',
    photos: [],
    coverPhotoUrl: ''
  },
  yasir: {
    id: 'yasir',
    name: 'Yasir',
    role: 'Origen marroquí',
    history: 'Familia mixta.',
    notes: 'Vínculo a través de la feria de Almería.',
    photos: [],
    coverPhotoUrl: ''
  },
  grupo: {
    id: 'grupo',
    name: 'Grupo de amigos',
    role: '(Madrid)',
    history: 'Viaje conjunto Feria de Almería → Conocen a Yasir.',
    notes: 'Punto de unión de todos los sujetos.',
    photos: [],
    coverPhotoUrl: ''
  }
};
