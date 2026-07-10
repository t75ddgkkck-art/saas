"use client";

import { useState } from "react";
import NextImage from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
// Lot 18 B19 : on renomme lucide `Image` en `ImageIcon` pour laisser
// `NextImage` clairement disponible pour les vraies images.
import { Image as ImageIcon, Plus, Trash2, Upload, Video } from "lucide-react";

const mockGallery = [
  {
    id: 1,
    url: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400&h=400&fit=crop",
    type: "image",
    title: "Réparation plomberie",
  },
  {
    id: 2,
    url: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=400&fit=crop",
    type: "image",
    title: "Installation salle de bain",
  },
  {
    id: 3,
    url: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop",
    type: "image",
    title: "Chauffe-eau",
  },
  {
    id: 4,
    url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=400&fit=crop",
    type: "image",
    title: "Cuisine moderne",
  },
];

export default function GalleryPage() {
  const [items] = useState(mockGallery);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Galerie</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gérez vos photos et vidéos</p>
        </div>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Ajouter des médias
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {/* Upload card */}
        <div className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 transition-colors hover:border-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-white dark:hover:bg-slate-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
            <Plus className="h-6 w-6 text-slate-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Ajouter</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Image ou vidéo</p>
          </div>
        </div>

        {items.map((item) => (
          <div key={item.id} className="group relative aspect-square overflow-hidden rounded-2xl">
            {/* Lot 18 B19 : next/image (AVIF/WebP auto + lazy loading) */}
            <NextImage
              src={item.url}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 transition-opacity group-hover:opacity-100">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-sm font-medium text-white">{item.title}</p>
                <div className="mt-2 flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
            {item.type === "video" && (
              <div className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5">
                <Video className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
