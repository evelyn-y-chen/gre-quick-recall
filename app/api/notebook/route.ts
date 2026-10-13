import { validNotebookBatch } from "../../notebookModel";
import { listNotebookBatches, readNotebookBatch, saveNotebookBatch } from "../../../db/notebookStore";

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) return Response.json({error: "收集编号无效"}, {status: 400});
      const saved = await readNotebookBatch(id);
      return saved ? Response.json(saved, {headers: {"Cache-Control": "no-store"}}) : Response.json({error: "这次收集不存在"}, {status: 404});
    }
    return Response.json({batches: await listNotebookBatches()}, {headers: {"Cache-Control": "no-store"}});
  } catch { return Response.json({error: "生词本读取失败，请重试"}, {status: 500}); }
}
export async function PUT(request: Request) {
  let payload;
  try { payload = await request.json(); }
  catch { return Response.json({error: "数据格式不正确"}, {status: 400}); }
  if (!payload || !validNotebookBatch(payload.batch) || !Number.isInteger(payload.revision) || payload.revision < 0) {
    return Response.json({error: "请填写来源和单词；每次最多收集 1000 个词，每项笔记或释义最多 4000 字。"}, {status: 400});
  }
  try {
    const saved = await saveNotebookBatch(payload.batch, payload.revision);
    if (!saved) return Response.json({error: "这次收集已在其他设备更新。你的草稿仍保留，可以另存为新收集。"}, {status: 409});
    return Response.json({revision: saved.revision});
  } catch { return Response.json({error: "云端保存失败，草稿仍保留，请重试"}, {status: 500}); }
}
