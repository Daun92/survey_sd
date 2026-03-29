import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuthAPI } from "@/lib/auth";

export async function POST(request: NextRequest) {
  // 인증 확인 (서버 클라이언트, 쿠키 기반)
  const auth = await requireAuthAPI();
  if (auth.error) return auth.error;

  const supabase = await createClient();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "JPG, PNG, WebP, GIF 파일만 업로드 가능합니다" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "파일 크기는 5MB 이하여야 합니다" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `hero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `survey-images/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Storage 업로드는 anon 클라이언트 사용 (RLS에서 anon INSERT 허용됨)
    const { error: uploadError } = await supabase.storage
      .from("survey-assets")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "업로드 실패: " + uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("survey-assets")
      .getPublicUrl(filePath);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "업로드 중 오류 발생" },
      { status: 500 }
    );
  }
}
