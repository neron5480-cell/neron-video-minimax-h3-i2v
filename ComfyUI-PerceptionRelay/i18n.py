# -*- coding: utf-8 -*-
"""English + Russian: every input tooltip gets an English line; node names and categories are bilingual.
Английский + русский: к каждой подсказке добавляется английская строка; названия и разделы — на двух языках."""

EN = {
    # Start / Hub
    "video": "Standard Load Video node goes here.",
    "video_path": "Fallback: full path to a video file (used if the video input is not connected).",
    "job_name": "Job folder name. Empty = from the file name.",
    "compare": "Build a side-by-side video: source vs result (side by side, split, stacked, face close-up).",
    "codec": "Final file codec. h264 plays everywhere; h265 10-bit is smaller and smoother in gradients.",
    "crf": "Compression quality: lower = better and bigger. 14–18 is good.",
    "frames_out": "Send frames to the output (for Video Combine / Create Video). Long videos use a lot of RAM — "
                  "you can turn it off, the result is saved as a file anyway.",
    "rating": "Your rating — goes into the file you can send us.",
    "comment": "A few words about the result — goes into the file you can send us.",
    "live": "Live window: move any card slider — see the frame right away.",
    "live_frame": "Which moment of the video the live window shows (0 = start, 1 = end).",
    "live_view": "Live window view: after / before / split.",
    "filename_prefix": "Output file name prefix.",
    # Scout
    "score_threshold": "Face detector confidence. Higher = fewer false faces.",
    "smooth": "Track smoothing, in frames. Removes detector jitter.",
    "min_track": "A face shorter than this many frames is treated as false (reflections, noise).",
    "max_gap": "How many frames a face may disappear and still count as the same face.",
    # Flow
    "engine": "Optical flow engine. RAFT is accurate (downloads ~20 MB once); DIS needs no download.",
    "scale": "Flow resolution scale. 1.0 is more precise but slower and needs more disk.",
    "iterations": "RAFT refinement steps.",
    "free_vram_before": "Unload ComfyUI models from VRAM before starting.",
    # Judge
    "strength_mid": "Calm the crawling mid texture (drift) — the main knob.",
    "strength_fine": "Calm the fine detail.",
    "fine_cut": "How much fine detail to remove entirely (texture only, edges are protected).",
    "chroma": "Calm colour noise (the eye sees colour coarsely, so this can be strong).",
    "radius": "How many neighbour frames on each side to compare.",
    "detail_size": "Border between 'skeleton' and 'texture', in pixels. Larger = the judge touches bigger things.",
    "face_keep": "Share of strength inside faces (facial motion is physics, not drift).",
    "eye_keep": "Share of strength in the eyes — let them blink and live.",
    "tolerance": "How big a difference still counts as drift. Bigger differences are edges/structure — kept.",
    "trust_flow_report": "Work at half strength on unstable segments reported by Flow.",
    # Edge
    "strength": "Sharpening strength (1 = max RCAS).",
    "passes": "How many passes. More = sharper, but riskier.",
    "edge_level": "From what brightness step a place counts as an edge.",
    "texture_keep": "Share of sharpening in texture (not on edges). 0 = leave texture alone.",
    "skip_faces": "Do not touch faces — the attention points handle them.",
    "denoise": "RCAS noise detector: do not sharpen noisy pixels.",
    "temporal": "Only act on what holds steady in time (compared with the previous frame along the flow).",
    # Tone skeleton
    "black_point": "Black point: + denser blacks (frames, edges), − open them up.",
    "black_density": "Black density: how 'inky' the deepest shadows sit. Midtones untouched.",
    "deep_shadows": "Deep shadows: + lighter, − darker.",
    "shadows": "Shadows: + lighter, − darker.",
    "transition": "Shadow-to-light transition: + lighter, − darker.",
    "face_fill": "Fill light on faces: gently open shadows only on faces (masks follow the face).",
    "shadow_saturation": "Colour in shadows: + richer (cinematic), − cleaner.",
    "shadow_neutral": "Remove colour cast in shadows — only the hue shift relative to the scene light.",
    "stabilize_black": "Keep the black level steady over time (highlights ignored).",
    "light_scale": "Size of the light layer in pixels. 0 = auto by resolution.",
    "edge_keep": "Which light steps count as edges and are not blurred. Lower = shadow edges held tighter.",
    # Seam
    "color_snap": "Colour follows luma edges: stops colour leaking across the border (4:2:0 bleed).",
    "snap_radius": "How far colour may leak and where to gather it from.",
    "narrow": "Narrow the half-tone on strong edges: thinner transition, no halos.",
    "narrow_radius": "Width of the transition band to narrow.",
    # Polish
    "smoothness": "×2 = one half-frame between frames (24→48). Motion blur = same frames, softer motion.",
    "shutter": "Motion blur only: shutter length (0.5 ≈ classic 180°).",
    "deflicker": "Even out overall brightness 'breathing' between frames.",
    "exposure": "Overall brightness (1 = unchanged).",
    "saturation": "Overall saturation (1 = unchanged).",
    "shadow_contrast": "Local contrast in shadows (volume in dark areas). Fine texture untouched.",
    "shadow_depth": "Shadow depth: + denser, − open up.",
    "shadow_level": "Up to what brightness a place counts as shadow.",
    # Basic
    "brightness": "Brightness: + lighter, − darker. Black and white stay in place.",
    "contrast": "Contrast: + punchier, − softer. Highlights and shadows are not clipped.",
    "sharpness": "Whole-picture sharpness, no halos. Note: it also raises texture shimmer.",
    # Points / Finish
    "eye_sharp": "Eye sharpness. Too much = 'eyeliner' look.",
    "eye_contrast": "Local eye contrast (a livelier look).",
    "contour_sharp": "Sharpness along the face edge. Too much = 'sticker' look.",
    "grain": "Film grain. Off by default: tests showed even 0.006 adds flicker. For stylisation only.",
    "grain_size": "Grain size, px.",
    "seed": "Grain random seed.",
    # Tools
    "mode": "What to show.",
    "count": "How many frames.",
    "crop_to_face": "Show a close-up around the first face.",
    "layout": "Comparison layout.",
    "keep_size": "Shrink the result to the source frame size (handy for large videos).",
    "line": "White divider line.",
}

CATEGORY = "Perception Relay · Эстафета восприятия"
CATEGORY_EXPERT = "Perception Relay · Эстафета восприятия/chain, expert · цепочка, эксперт"


def apply(classes):
    """Добавить английскую строку к подсказкам всех входов."""
    for cls in classes:
        orig = cls.INPUT_TYPES
        if getattr(orig, "_relay_i18n", False):
            continue

        def wrapped(c=cls, o=orig):
            d = o() if not hasattr(o, "__func__") else o.__func__(c)
            for group in ("required", "optional"):
                for name, spec in list(d.get(group, {}).items()):
                    en = EN.get(name)
                    if not en:
                        continue
                    if len(spec) > 1 and isinstance(spec[1], dict):
                        opts = dict(spec[1])
                        tip = opts.get("tooltip", "")
                        if "EN:" not in tip:
                            opts["tooltip"] = (tip + "\n\nEN: " + en) if tip else ("EN: " + en)
                        d[group][name] = (spec[0], opts) + tuple(spec[2:])
                    else:
                        d[group][name] = (spec[0], {"tooltip": "EN: " + en})
            return d

        wrapped._relay_i18n = True
        cls.INPUT_TYPES = classmethod(lambda c, w=wrapped: w(c))
        cls.INPUT_TYPES.__func__._relay_i18n = True
