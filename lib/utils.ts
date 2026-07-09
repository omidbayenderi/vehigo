import type { z } from "zod";

/**
 * FormData'yı düz objeye çevirir ve boş string değerleri eler —
 * boş bırakılan <select>/<input> alanları zod'un .optional() ile
 * uyumlu olsun diye "" yerine tamamen yok sayılır.
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const entries = Object.fromEntries(formData.entries());
  return Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== ""));
}

/**
 * Kısmi (patch tarzı) güncellemeler için: schema.partial().parse(input) tek
 * başına kullanılırsa, .default(...) taşıyan alanlar input'ta hiç
 * bulunmadığında bile varsayılan değerle doldurulur — bu da update()
 * çağrısında o sütunları istemeden sıfırlar. Burada sonucu, yalnızca
 * input'ta gerçekten var olan anahtarlarla sınırlıyoruz.
 */
export function partialUpdateFields<Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
  input: Record<string, unknown>,
): Partial<z.infer<z.ZodObject<Shape>>> {
  const parsed = schema.partial().parse(input) as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (key in parsed) result[key] = parsed[key];
  }
  return result as Partial<z.infer<z.ZodObject<Shape>>>;
}
