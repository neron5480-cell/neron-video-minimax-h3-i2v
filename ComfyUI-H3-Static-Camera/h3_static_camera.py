import json
import re

class MyH3StaticCamera:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                # МЕЖДУНАРОДНЫЙ ТУМБЛЕР РЕЖИМА ВОРКФЛУ
                "workflow_mode": ([
                    "[LLM] Autoprompter (Naxdy Brief) / Автопромтер", 
                    "[Manual] Regular Text (Direct Input) / Ручной ввод"
                ], {"default": "[LLM] Autoprompter (Naxdy Brief) / Автопромтер"}),
                
                # МЕЖДУНАРОДНЫЕ НАСТРОЙКИ РАКУРСА
                "camera_mode": ([
                    "AUTO (Listen to autoprompter) / АВТО",
                    "FRONT (Straight view) / ФРОНТ", 
                    "LEFT (Side view) / СЛЕВА", 
                    "RIGHT (Side view) / СПРАВА", 
                    "BACK (From behind) / СЗАДИ", 
                    "TOP (High angle) / СВЕРХУ", 
                    "BOTTOM (Low angle) / СНИЗУ"
                ], {"default": "AUTO (Listen to autoprompter) / АВТО"}),
                "framing_type": (["wide shot", "medium shot", "close-up"], {"default": "medium shot"}),
                "total_frames": ("INT", {"default": 124, "min": 1, "max": 1000, "step": 1}),
                "fps": ("INT", {"default": 24, "min": 1, "max": 60, "step": 1}),
                "fixed_distance": ("FLOAT", {"default": 1.00, "min": 0.10, "max": 3.00, "step": 0.05}),
            },
            "optional": {
                "autoprompt_text": ("STRING", {"forceInput": True}),  # Сюда идет выход из Qwen
                "manual_prompt": ("STRING", {"default": "", "multiline": True}),  # ВХОД ДЛЯ ОБЫЧНОГО ТЕКСТА
                "subject_details": ("STRING", {"default": "", "multiline": True}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING", "INT")
    RETURN_NAMES = ("minimax_prompt", "storyboard_json", "h3world_actions", "frames_count")
    FUNCTION = "generate_static_data"
    CATEGORY = "AIVideoPostprocessing"

    def generate_static_data(self, workflow_mode, camera_mode, framing_type, total_frames, fps, fixed_distance, autoprompt_text="", manual_prompt="", subject_details=""):
        safe_fps = max(1, fps)
        duration = round(total_frames / safe_fps, 2)
        
        azimuth_val = 0.0
        elevation_val = 0.0
        zone_name = "Front"
        camera_text_desc = "completely locked-off camera remains fixed in a front view"
        summary_camera_addon = "while the camera stays completely locked in a front view."

        # АВТООПРЕДЕЛЕНИЕ: проверка выбранного режима
        if "[LLM]" in workflow_mode:
            incoming_text = str(autoprompt_text)
        else:
            incoming_text = str(manual_prompt)
            
        text_to_analyze = (incoming_text + " " + str(subject_details)).lower()
        is_auto = ("AUTO" in camera_mode)
        
        # 1. СКАНИРОВАНИЕ ТЕКСТА НА ПРЕДМЕТ ВЕКТОРОВ (Поддерживает RU и EN ключевые слова)
        if is_auto:
            if any(x in text_to_analyze for x in ["слева", "left side", "left view"]):
                camera_mode_resolved = "LEFT"
            elif any(x in text_to_analyze for x in ["справа", "right side", "right view"]):
                camera_mode_resolved = "RIGHT"
            elif any(x in text_to_analyze for x in ["сзади", "behind", "back view"]):
                camera_mode_resolved = "BACK"
            elif any(x in text_to_analyze for x in ["сверху", "high angle", "top view", "high-angle"]):
                camera_mode_resolved = "TOP"
            elif any(x in text_to_analyze for x in ["снизу", "low angle", "bottom view"]):
                camera_mode_resolved = "BOTTOM"
            else:
                camera_mode_resolved = "FRONT"
        else:
            camera_mode_resolved = camera_mode

        # 2. МАТЕМАТИКА 3D УГЛОВ И СИНТАКСИС ДЛЯ КОРРЕКЦИИ ТЕКСТА
        if "LEFT" in camera_mode_resolved or "СЛЕВА" in camera_mode_resolved:
            azimuth_val = -90.0
            zone_name = "Left"
            camera_text_desc = "static camera positioned strictly on the LEFT side, showing a side view"
            summary_camera_addon = "while the camera stays completely locked in a left side view."
        elif "RIGHT" in camera_mode_resolved or "СПРАВА" in camera_mode_resolved:
            azimuth_val = 90.0
            zone_name = "Right"
            camera_text_desc = "static camera positioned strictly on the RIGHT side, showing a side view"
            summary_camera_addon = "while the camera stays completely locked in a right side view."
        elif "BACK" in camera_mode_resolved or "СЗАДИ" in camera_mode_resolved:
            azimuth_val = 180.0
            zone_name = "Behind"
            camera_text_desc = "static camera positioned strictly BEHIND the subject, showing a back view"
            summary_camera_addon = "while the camera stays completely locked in a back view."
        elif "TOP" in camera_mode_resolved or "СВЕРХУ" in camera_mode_resolved:
            elevation_val = 45.0
            zone_name = "Top (High Angle)"
            camera_text_desc = "static camera positioned at a HIGH ANGLE, looking down from above"
            summary_camera_addon = "while the camera stays completely locked in a high angle top view."
        elif "BOTTOM" in camera_mode_resolved or "СНИЗУ" in camera_mode_resolved:
            elevation_val = -30.0
            zone_name = "Bottom (Low Angle)"
            camera_text_desc = "static camera positioned at a LOW ANGLE, looking up from below"
            summary_camera_addon = "while the camera stays completely locked in a low angle bottom view."
        else:
            azimuth_val = 0.0
            elevation_val = 0.0
            zone_name = "Front"
            camera_text_desc = "completely locked-off camera remains fixed in a front view"
            summary_camera_addon = "while the camera stays completely locked in a front view."

        # Базовая жесткая инструкция камеры для MiniMax
        base_prompt = f"[CAMERA] [Static shot] A {camera_text_desc}. "
        base_prompt += f"The framing is a rigid {framing_type} at distance {fixed_distance}. Absolutely no zoom, no camera parallax, no dolly, and no tracking. "
        base_prompt += "All background elements and furniture are anchored and perfectly rigid."

        # 3. СБОРКА И МОДИФИКАЦИЯ ТЕКСТА
        if "[LLM]" in workflow_mode:
            orig_text = incoming_text.strip()
            if is_auto:
                full_prompt = orig_text if orig_text else f"{base_prompt}"
            else:
                if orig_text:
                    cleaned = re.sub(r'[,.]?\s*while\s+the\s+camera\s+stays\s+[^.\n]+', '', orig_text, flags=re.IGNORECASE)
                    cleaned = re.sub(r'[,.]?\s*and\s+the\s+camera\s+stays\s+[^.\n]+', '', cleaned, flags=re.IGNORECASE)
                    cleaned = re.sub(r'[,.]?\s*the\s+camera\s+remains\s+[^.\n]+', '', cleaned, flags=re.IGNORECASE)
                    cleaned = re.sub(r'[,.]?\s*camera\s+remains\s+[^.\n]+', '', cleaned, flags=re.IGNORECASE)
                    cleaned = re.sub(r'\[camera\][^.\n]+', '', cleaned, flags=re.IGNORECASE)
                    
                    lines = cleaned.split('\n')
                    for i, line in enumerate(lines):
                        if line.strip().lower().startswith("summary:"):
                            pure_line = line.strip().rstrip('.')
                            lines[i] = f"{pure_line}, {summary_camera_addon}"
                            break
                    full_prompt = f"{base_prompt}\n\n{'\n'.join(lines)}"
                else:
                    full_prompt = base_prompt
        else:
            user_text = incoming_text.strip()
            built_prompt = f"{base_prompt}\n\n"
            built_prompt += f"summary: [keyframe completion] {user_text if user_text else 'A scene unfolds'}, {summary_camera_addon}\n"
            
            if subject_details and subject_details.strip():
                built_prompt += f"subject_definitions: {subject_details.strip()}\n"
                
            full_prompt = built_prompt

        # 4. ГЕНЕРАЦИЯ СТРУКТУРЫ JSON
        storyboard = {
            "schema": "h3-camera-plan-v1",
            "camera_choreography": f"CAMERA LOCKED AT {zone_name.upper()} POSITION.",
            "total_orbit_travel_degrees": 0.0,
            "net_orbit_travel_degrees": 0.0,
            "camera_speed": "constant",
            "duration": duration,
            "fps": float(safe_fps),
            "segments": [
                {
                    "id": "frozen_automatic_anchor",
                    "start": 0.0,
                    "end": duration,
                    "camera_travel": "none",
                    "signed_orbit_degrees": 0.0,
                    "interpolation": "linear",
                    "start_pose": {"azimuth": azimuth_val, "elevation": elevation_val, "distance": fixed_distance},
                    "end_pose": {"azimuth": azimuth_val, "elevation": elevation_val, "distance": fixed_distance}
                }
            ],
            "final": f"Freeze composition until {duration}s."
        }

        legacy_actions = [
            {"time": 0.0, "azimuth": azimuth_val, "elevation": elevation_val, "distance": fixed_distance},
            {"time": duration, "azimuth": azimuth_val, "elevation": elevation_val, "distance": fixed_distance}
        ]

        return (full_prompt, json.dumps(storyboard, indent=2), json.dumps(legacy_actions), total_frames)

NODE_CLASS_MAPPINGS = {
    "FixedCameraH3Presets": MyH3StaticCamera
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "FixedCameraH3Presets": "⚡ Fixed Camera H3 (Presets)"
}
