import { AdminError, adminMessage, reasonOf, requireAdmin } from './guards';
import { nextOrder } from './order';

/**
 * Galería: subida de imágenes con **Cloudinary** (unsigned upload) y
 * metadatos en Firestore (`gallery` → `{name, url, public_id}`).
 *
 * La subida es un POST público con `upload_preset` (sin API secret en el
 * cliente). El borrado en Cloudinary requiere el API secret, así que solo se
 * elimina el documento de Firestore.
 */

export interface GalleryDoc {
  id: string;
  name: string;
  url: string;
  /** Identificador en Cloudinary; `null` en docs heredados (JSON/Storage). */
  public_id?: string | null;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const UPLOAD_TIMEOUT_MS = 60_000;

/** Respuesta del endpoint unsigned de Cloudinary. */
interface CloudinaryUploadResponse {
  secure_url?: string;
  public_id?: string;
  error?: { message?: string };
}

function cloudinaryConfig(): { endpoint: string; uploadPreset: string } {
  const cloudName = String(import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME ?? '').trim();
  const uploadPreset = String(import.meta.env.PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '').trim();

  if (!cloudName || !uploadPreset) {
    throw new AdminError(
      'Cloudinary no está configurado: faltan PUBLIC_CLOUDINARY_CLOUD_NAME o PUBLIC_CLOUDINARY_UPLOAD_PRESET.',
    );
  }

  return {
    endpoint: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    uploadPreset,
  };
}

function toGalleryDoc(id: string, data: Record<string, unknown>): GalleryDoc {
  return {
    id,
    name: typeof data.name === 'string' ? data.name : '',
    url: typeof data.url === 'string' ? data.url : '',
    public_id: typeof data.public_id === 'string' ? data.public_id : null,
  };
}

/** Imágenes de la galería con id de documento. Requiere admin. */
export async function listGalleryItems(): Promise<GalleryDoc[]> {
  await requireAdmin();

  const { db } = await import('../firebase');
  const { collection, getDocs } = await import('firebase/firestore');

  try {
    const snapshot = await getDocs(collection(db, 'gallery'));
    return snapshot.docs.map((document) => toGalleryDoc(document.id, document.data()));
  } catch (error) {
    console.warn('⚠️ listGalleryItems falló:', reasonOf(error));
    throw new AdminError(adminMessage(error, 'No fue posible cargar la galería.'));
  }
}

/** Sube la imagen a Cloudinary y guarda `{name, url, public_id}` en `gallery`. */
export async function uploadGalleryImage(file: File, rawName: string): Promise<GalleryDoc> {
  await requireAdmin();

  const name = rawName.trim() || file.name.replace(/\.[^.]+$/, '').trim();
  if (!name) throw new AdminError('La imagen necesita un nombre.');
  if (!file.type.startsWith('image/')) throw new AdminError('El archivo debe ser una imagen.');
  if (file.size > MAX_UPLOAD_BYTES) throw new AdminError('La imagen supera los 5 MB.');

  const { endpoint, uploadPreset } = cloudinaryConfig();

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', uploadPreset);

  let uploaded: { url: string; publicId: string };
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => null)) as CloudinaryUploadResponse | null;

    if (!response.ok || !payload || !payload.secure_url || !payload.public_id) {
      throw new AdminError(
        `Cloudinary rechazó la subida: ${payload?.error?.message ?? `HTTP ${response.status}`}`,
      );
    }

    uploaded = { url: payload.secure_url, publicId: payload.public_id };
  } catch (error) {
    if (error instanceof AdminError) throw error;
    console.warn('⚠️ Cloudinary falló:', reasonOf(error));
    throw new AdminError(
      /timeout/i.test(reasonOf(error))
        ? 'La subida tardó demasiado. Intenta de nuevo.'
        : 'No fue posible subir la imagen a Cloudinary.',
    );
  }

  const { db } = await import('../firebase');
  const { addDoc, collection } = await import('firebase/firestore');

  try {
    const document = await addDoc(collection(db, 'gallery'), {
      name,
      url: uploaded.url,
      public_id: uploaded.publicId,
      // La lectura pública usa `orderBy('order')`: sin el campo, Firestore
      // excluye el doc y la imagen no aparecería en el sitio.
      order: await nextOrder('gallery'),
    });
    return { id: document.id, name, url: uploaded.url, public_id: uploaded.publicId };
  } catch (error) {
    console.warn('⚠️ gallery addDoc falló:', reasonOf(error));
    throw new AdminError(
      adminMessage(error, 'La imagen se subió a Cloudinary pero no se guardó en la galería.'),
    );
  }
}

/** Elimina el documento de `gallery`. Requiere admin. */
export async function deleteGalleryItem(item: GalleryDoc): Promise<void> {
  await requireAdmin();
  if (!item.id) throw new AdminError('Imagen inválida.');

  const { db } = await import('../firebase');
  const { deleteDoc, doc } = await import('firebase/firestore');

  try {
    await deleteDoc(doc(db, 'gallery', item.id));
  } catch (error) {
    console.warn('⚠️ deleteGalleryItem falló:', reasonOf(error));
    throw new AdminError(adminMessage(error, 'No fue posible eliminar la imagen.'));
  }

  // El archivo en Cloudinary no se borra desde el cliente: exige el API secret.
}
