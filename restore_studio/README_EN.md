# restore_studio — English version

Russian version: [README.md](README.md).

Custom nodes for ComfyUI: restoration, colorization and upscaling of old photos.

## Contents

| Node | Purpose |
|---|---|
| `Restore Studio` | Main processing: upscaling, denoising, auto-correction, colorization, face restoration |
| `Live Preview` | Real-time preview without pressing Queue |

Both nodes are self-contained. You can pull them out and drop them into any other workflow — no external dependencies.

## Restore Studio features

- Upscaling (model is connected from outside via `UpscaleModelLoader`)
- Auto white balance and auto levels
- Denoise and despeckle
- Face restoration via CodeFormer
- Colorization of black-and-white photos via DDColor
- Brightness, contrast, saturation, sharpness
- RGB channel balance
- Presets: Old B&W Photo, Portrait, Landscape, Film Look, Vintage, Manual

## Live Preview features

- Shows the result in a large window
- Reacts to slider movement in real time
- No need to press Queue
- Works via its own HTTP endpoint

## Installation

1. Download the repository: **Code → Download ZIP**
2. Unpack the archive
3. Copy the `restore_studio` folder into:

```
ComfyUI/custom_nodes/
```

The result should be:

```
ComfyUI/custom_nodes/restore_studio/
```

4. Restart ComfyUI

## CodeFormer models

All files from release [v0.1.0](https://github.com/sczhou/CodeFormer/releases/tag/v0.1.0) go into:

```
ComfyUI/custom_nodes/restore_studio/models/
```

| File | Link |
|---|---|
| `codeformer.pth` | [download](https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/codeformer.pth) |
| `detection_Resnet50_Final.pth` | [download](https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/detection_Resnet50_Final.pth) |
| `parsing_parsenet.pth` | [download](https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/parsing_parsenet.pth) |
| `yolov5l-face.pth` | [download](https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/yolov5l-face.pth) |

Create the `models` folder manually if it does not exist.

Full structure:

```
ComfyUI/custom_nodes/restore_studio/
  models/
    codeformer.pth
    detection_Resnet50_Final.pth
    parsing_parsenet.pth
    yolov5l-face.pth
```

## Restore Studio parameters

| Parameter | Description |
|---|---|
| `preset` | Ready-made preset or Manual for full control |
| `FACE RESTORE` | Enable/disable face restoration |
| `FACE STRENGTH` | Face restoration strength |
| `FACE SHARPEN` | Face sharpening |
| `AUTO WB` | Auto white balance |
| `AUTO LEVELS` | Auto levels |
| `DENOISE` | Denoising |
| `DESPECKLE` | Remove specks and scratches |
| `COLORIZE` | Colorize black-and-white photos |
| `COLORIZE STRENGTH` | Colorization saturation |
| `BRIGHTNESS` | Brightness |
| `CONTRAST` | Contrast |
| `SATURATION` | Saturation |
| `SHARPNESS` | Sharpness |
| `RGB RED / GREEN / BLUE` | Channel balance |
| `UPSCALE SCALE` | Upscale factor (2 = x2) |
| `UPSCALE SHARPEN` | Sharpening after upscale |

## Usage

1. Add the `Restore Studio` node to the canvas
2. Connect `image` (required) and `upscale_model` (optional)
3. Adjust the parameters
4. Connect the `IMAGE` output to the next node or to `SaveImage`
5. For preview, add `Live Preview` and connect it to the `Restore Studio` output

## Notes

- If `FACE RESTORE` is off, CodeFormer models are not used and do not need to be downloaded
- `Live Preview` may slow down weak GPUs. Disable via right-click → **Mute** or **Bypass**
- For other nodes (such as Facerestore CF or ReActor), the same models are sometimes placed in `ComfyUI/models/facerestore_models/`. For this node the path is different — inside its own folder in `custom_nodes`

## License

MIT — see [LICENSE](../LICENSE).

## Credits

- [sczhou/CodeFormer](https://github.com/sczhou/CodeFormer) — face restoration models
