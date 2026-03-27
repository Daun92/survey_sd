import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuthAPI } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const auth = await requireAuthAPI();
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "JPG, PNG, WebP, GIF 파일만 업로드 가능합니다" },
        { status: 400 }
      );
    }

    // Validate file size (5MB)
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

    const { error: uploadError } = await supabase.storage
      .from("survey-assets")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      // If bucket doesn't exist, try creating it
      if (uploadError.message?.includes("not found") || uploadError.message?.includes("Bucket")) {
        await supabase.storage.createBucket("survey-assets", {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024,
        });
        const { error: retryError } = await supabase.storage
          .from("survey-assets")
          .upload(filePath, buffer, { contentType: file.type, upsert: false });
        if (retryError) {
          return NextResponse.json(
            { error: "업로드 실패: " + retryError.message },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "업로드 실패: " + uploadError.message },
          { status: 500 }
        );
      }
    }

    const { data: urlData } = supabase.storage
      .from("survey-assets")
      .getPublicUrl(filePath);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "업로드 중 오류 발생" },
      { status: 500 }
    );
  }
}
