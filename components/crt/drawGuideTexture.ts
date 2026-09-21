import type {GuideProgram} from "@/components/crt/projectPreview";

export function drawGuideTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  programs: GuideProgram[],
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const fontSize = Math.min(Math.max(width * 0.028, 18), 36);
  const em = fontSize;
  const padX = em * 0.8;
  const headerH = em * 2.05;
  const timesH = em * 1.3;
  const footerH = em * 1.55;
  const rowH = em * 2.45;
  const chW = em * 3.2;
  const slotW = em * 4.4;

  ctx.font = `500 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgba(255, 248, 198, 0.92)";
  ctx.textAlign = "left";
  ctx.fillText("TV GUIDE", padX, headerH * 0.5);
  ctx.textAlign = "right";
  ctx.fillText("8:00 PM", width - padX, headerH * 0.5);

  const timesY = headerH;
  ctx.fillStyle = "rgba(158, 194, 255, 0.7)";
  ctx.textAlign = "left";
  ctx.fillText("CH", padX, timesY + timesH * 0.5);
  const timeSlots = ["8:00", "8:30", "9:00"];
  const gridStart = padX + chW;
  const gridW = width - padX * 2 - chW;
  timeSlots.forEach((label, index) => {
    const x = gridStart + ((index + 1) / 3) * gridW;
    ctx.textAlign = "right";
    ctx.fillText(label, x, timesY + timesH * 0.5);
  });

  const bodyY = headerH + timesH;
  const bodyH = Math.max(0, height - bodyY - footerH);

  if (programs.length === 0) {
    ctx.fillStyle = "rgba(180, 210, 255, 0.55)";
    ctx.textAlign = "left";
    ctx.fillText("NO PROGRAMS", padX, bodyY + em * 1.2);
  } else {
    programs.forEach((program, index) => {
      const y = bodyY + index * rowH;
      if (y > bodyY + bodyH) {
        return;
      }
      const mid = y + rowH * 0.5;
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(243, 226, 122, 0.92)";
      ctx.fillText(program.channel, padX, mid);
      ctx.fillStyle = "rgba(230, 242, 255, 0.95)";
      const titleX = padX + chW;
      const titleMax = width - padX - slotW - titleX;
      fillEllipsis(ctx, program.title, titleX, mid, titleMax);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(158, 194, 255, 0.75)";
      ctx.fillText(program.time, width - padX, mid);
    });
  }

  ctx.fillStyle = "rgba(255, 248, 198, 0.62)";
  ctx.textAlign = "left";
  ctx.font = `500 ${fontSize * 0.85}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.fillText(
    "SELECT PROGRAM  •  ENTER TO PLAY",
    padX,
    height - footerH * 0.5,
  );
}

function fillEllipsis(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  if (maxWidth <= 0) {
    return;
  }
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  let next = text;
  while (next.length > 1 && ctx.measureText(`${next}…`).width > maxWidth) {
    next = next.slice(0, -1);
  }
  ctx.fillText(`${next}…`, x, y);
}
