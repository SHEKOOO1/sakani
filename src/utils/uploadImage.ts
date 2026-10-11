// رفع صورة من الجهاز إلى الخادم (/api/media/image) وإرجاع الرابط الدائم.
// يُستخدم للصور الشخصية وصور الوجبات/المنتجات. يعتمد على جلسة الكوكي (credentials: include)
// حتى يعمل خارج مزوّدي React (مثل الرفع داخل النماذج).
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/media/image', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    // استجابة غير JSON
  }

  const url = data?.data?.url;
  if (!res.ok || !url) {
    throw new Error(data?.message || 'فشل رفع الصورة');
  }
  return url;
}
