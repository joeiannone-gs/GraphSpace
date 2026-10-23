// One-time conversion of the old server's public datasets into browser-loadable files.
// Usage (needs protobufjs): node scripts/convert-datasets.mjs legacy/shared/protos legacy/computeserver/server/EBS/public public/datasets
import protobuf from 'protobufjs';
import fs from 'node:fs';
import path from 'node:path';

const [protosDir, ebsDir, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

// points-2d: safetensors F32 [1000, 2] -> JSON {shape, data}
{
  const buf = fs.readFileSync(path.join(ebsDir, 'tensors/public-2d-01.safetensors'));
  const headerLen = Number(buf.readBigUInt64LE(0));
  const header = JSON.parse(buf.subarray(8, 8 + headerLen).toString('utf8'));
  const entry = header['public-2d-01'];
  if (entry.dtype !== 'F32') throw new Error('unexpected dtype ' + entry.dtype);
  const start = 8 + headerLen + entry.data_offsets[0];
  const end = 8 + headerLen + entry.data_offsets[1];
  const bytes = buf.subarray(start, end);
  const f32 = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const data = Array.from(f32, (v) => Math.round(v * 1e6) / 1e6);
  fs.writeFileSync(path.join(outDir, 'points-2d.json'), JSON.stringify({ shape: entry.shape, data }));
  console.log('points-2d', entry.shape, data.length);
}

// mnist-200: NestedArrayStore{ "public-mnist-01": [[img 28x28, onehot 10] x 200] } -> uint8 binary
{
  const root = new protobuf.Root();
  root.resolvePath = (_origin, target) => path.join(protosDir, path.basename(target));
  await root.load(['nested_array_store.proto'], { keepCase: true });
  const Store = root.lookupType('NestedArrayStore');
  const store = Store.toObject(Store.decode(fs.readFileSync(path.join(ebsDir, 'nested-array/public-mnist-01.bin'))), { defaults: false });
  const keys = Object.keys(store.map);
  const na = store.map[keys[0]].value;
  const toJs = (n) => n.arrayOfValues
    ? (n.arrayOfValues.values ?? []).map((v) => v.floatValue ?? v.stringValue)
    : (n.arrayOfNestedArrays.nestedArrays ?? []).map(toJs);
  const samples = toJs(na);
  const N = samples.length;
  const images = new Uint8Array(N * 784);
  const labels = new Uint8Array(N);
  samples.forEach(([img, onehot], i) => {
    if (img.length !== 28 || img[0].length !== 28) throw new Error('bad image shape at ' + i);
    img.forEach((row, r) => row.forEach((v, c) => { images[i * 784 + r * 28 + c] = v ?? 0; }));
    const lab = onehot.findIndex((v) => v === 1);
    if (lab < 0) throw new Error('bad label at ' + i);
    labels[i] = lab;
  });
  const out = Buffer.concat([Buffer.from(images.buffer), Buffer.from(labels.buffer)]);
  fs.writeFileSync(path.join(outDir, 'mnist-200.bin'), out);
  const counts = Array.from({ length: 10 }, (_, d) => labels.filter((l) => l === d).length);
  console.log('mnist-200', { keys, N, bytes: out.length, maxPixel: images.reduce((a, b) => Math.max(a, b), 0), labelCounts: counts });
}
