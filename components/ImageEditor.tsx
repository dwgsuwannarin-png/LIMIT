import React, { useState, useEffect, useRef } from 'react';
import {
  LogOut,
  Globe,
  Upload,
  Undo2,
  Redo2,
  FlipHorizontal,
  RotateCw,
  Download,
  RefreshCcw,
  Sparkles,
  Layout,
  Home,
  Box,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  LayoutDashboard,
  Trash2,
  ImageIcon as PictureIcon,
  Key,
  Sofa,
  BedDouble,
  Utensils,
  Bath,
  Palette,
  Ruler,
  PenTool,
  Brush,
  Mountain,
  FileText,
  Cuboid,
  Settings,
  X,
  Check,
  ExternalLink,
  ArrowUp,
  Zap,
  Crown,
  Save,
  ShieldAlert,
  BatteryWarning
} from 'lucide-react';
import { UserData } from '../types';
import { GoogleGenAI } from "@google/genai";
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface ImageEditorProps {
  user: UserData | null;
  onLogout: () => void;
  onBackToAdmin?: () => void;
}

// --- IMAGE PROCESSING HELPER ---
const transformImage = (base64Str: string, type: 'rotate' | 'flip'): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(base64Str); return; }
            
            if (type === 'rotate') {
                canvas.width = img.height;
                canvas.height = img.width;
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(90 * Math.PI / 180);
                ctx.drawImage(img, -img.width / 2, -img.height / 2);
            } else {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0);
            }
            resolve(canvas.toDataURL());
        };
        img.onerror = () => resolve(base64Str);
    });
};

// --- CONSTANTS ---
const MODEL_PREMIUM = 'gemini-3-pro-image-preview';
const MODEL_STANDARD = 'gemini-2.5-flash-image';

const DEFAULT_NEGATIVE_PROMPT = 'low quality, low resolution, blurry, distorted, watermark, text, signature, bad composition, ugly, geometric imperfections';

const ROOM_TYPES = [
  { id: 'living', labelEN: 'Living Room', labelTH: 'ห้องรับแขก', icon: Sofa, prompt: 'Interior design of a living room, comfortable sofa arrangement, coffee table, TV wall unit, ambient lighting, cozy and inviting atmosphere' },
  { id: 'bedroom', labelEN: 'Bedroom', labelTH: 'ห้องนอน', icon: BedDouble, prompt: 'Interior design of a master bedroom, king size bed with premium bedding, bedside tables, wardrobe, soft lighting, relaxing sanctuary vibe' },
  { id: 'kitchen', labelEN: 'Kitchen', labelTH: 'ห้องครัว', icon: Utensils, prompt: 'Interior design of a kitchen, dining area integration, counter bar, refrigerator, built-in cabinets, clean countertops, functional layout' },
  { id: 'bathroom', labelEN: 'Bathroom', labelTH: 'ห้องน้ำ', icon: Bath, prompt: 'Interior design of a bathroom, bathtub, separate shower zone, vanity mirror with lighting, sanitary ware, clean tiles, hygienic look' }
];

const INTERIOR_STYLES = [
  { id: 'modern', labelEN: 'Modern', labelTH: 'โมเดิร์น', prompt: 'Modern style, sleek design, clean lines, neutral color palette, functional furniture, polished finishes' },
  { id: 'contemporary', labelEN: 'Contemp.', labelTH: 'ร่วมสมัย', prompt: 'Contemporary style, current trends, sophisticated textures, curved lines, mix of materials, artistic touch' },
  { id: 'minimal', labelEN: 'Minimal', labelTH: 'มินิมอล', prompt: 'Minimalist style, simplicity, clutter-free, monochromatic colors, open space, functional design, zen atmosphere' },
  { id: 'tropical', labelEN: 'Tropical', labelTH: 'ทรอปิคอล', prompt: 'Tropical style, natural materials, wood textures, indoor plants, airy atmosphere, connection to nature, resort-like feel' },
  { id: 'classic', labelEN: 'Classic', labelTH: 'คลาสสิค', prompt: 'Classic luxury style, elegant moldings, rich fabrics, chandelier, symmetrical layout, timeless aesthetic, sophisticated' },
  { id: 'resort', labelEN: 'Resort', labelTH: 'รีสอร์ท', prompt: 'Luxury resort style, vacation vibe, spacious, natural light, premium materials, relaxing and calm environment' }
];

const PLAN_STYLES = [
  { id: 'iso_structure', labelEN: 'Iso (Strict Layout)', labelTH: 'ไอโซ (ยึดโครงสร้าง)', prompt: '3D Isometric floor plan view. Convert the 2D layout into 3D. Clean architectural model style. White walls, soft shadows. High angle view showing the layout depth. Strictly preserve wall positions.' },
  { id: 'blueprint', labelEN: 'Blueprint', labelTH: 'พิมพ์เขียว', prompt: 'Architectural blueprint style, white technical lines on blue background, precise measurements, clear lighting direction casting soft shadows to indicate depth' },
  { id: 'neon', labelEN: 'Neon', labelTH: 'นิออน', prompt: 'Neon cyberpunk style floor plan, glowing lines on dark background, high contrast, dramatic lighting effects with distinct cast shadows' },
  { id: 'isometric', labelEN: 'Iso Blue', labelTH: 'โครงสร้างแสงฟ้า', prompt: 'Isometric floor plan, glowing blue structural lines, dark background, bokeh effect (blurred background), depth of field, high contrast, futuristic architectural style.' },
  { id: 'oblique', labelEN: 'Clay 3D', labelTH: '3D ดินปั้น', prompt: '3D clay render style floor plan, isometric oblique view, soft rounded edges, matte finish, cute and playful miniature diorama aesthetic. Use a monochromatic single-tone color palette (shades of white, cream, or soft beige) for the entire structure and furniture. No colorful elements. Soft global illumination, strong ambient occlusion, clean and minimal toy-like appearance.' },
  { id: 'wood_model', labelEN: 'Wood Model', labelTH: 'โมเดลไม้', prompt: 'Isometric view made of light wood and matte white materials, placed on construction blueprints spread on a table. Contains miniature furniture details such as kitchen counters, wooden chairs, and gray sofas. Natural light shines through giving a soft and realistic feel. Shallow depth of field makes the background and other components slightly blurred to emphasize the focus on the room model.' },
  { id: 'blueprint_grunge', labelEN: 'Blueprint Grunge', labelTH: 'พิมพ์เขียว (Grunge)', prompt: 'Architectural floor plan, top-down view, white lines on dark blue grunge paper texture background, blueprint style, thick walls casting drop shadows for depth, detailed furniture layout including bedroom kitchen and garage, sketched white outline trees surrounding, high contrast, aesthetic architectural presentation, 2D graphic design' }
];

const EXTERIOR_SCENES = [
  { id: 'pool_villa', labelEN: 'Pool Villa', labelTH: 'พูลวิลล่า', prompt: 'A wide-angle architectural photograph of a luxurious modern minimalist building, viewed from the far end of its backyard under a bright clear blue sky. Two-story structure, clean white cubic forms, large glass windows. A long rectangular swimming pool with clear turquoise water runs parallel to the building. Manicured green lawn, paved walkway, wooden sun loungers. Mature palm trees and tropical plants, resort-like atmosphere. Bright midday sunlight casting sharp shadows.' },
  { id: 'housing', labelEN: 'Housing Estate', labelTH: 'บ้านจัดสรร', prompt: 'A wide-angle architectural photograph of a house situated in an upscale luxury suburban neighborhood. Foreground features a spacious, clean paved asphalt driveway leading up to the structure. Surrounded by perfectly manicured landscape design, low trimmed hedges, ornamental shrubs, needle pine trees, and a lush green lawn. Clear gradient blue sky with soft natural daylight. Warm welcoming yellow light glows from windows.' },
  { id: 'european', labelEN: 'Euro Garden', labelTH: 'บ้านยุโรปสวนดัด', prompt: 'A grand architectural photograph situated in an opulent formal French garden estate. A long, elegant light-beige cobblestone paved driveway leads centrally towards the structure. Foreground dominated by perfectly manicured geometric boxwood hedges, low-trimmed garden mazes, and symmetrical cone-shaped cypress trees. Lush vibrant green lawns. Dramatic sky with textured clouds. Soft diffused natural daylight. High-end real estate photography.' },
  { id: 'green_walkway', labelEN: 'Green Walkway', labelTH: 'ทางเดินสวนป่า', prompt: 'A photorealistic architectural photograph nestled in a lush, mature woodland garden. A winding light-grey flagstone pathway leads from the foreground gate towards the building, flanked by manicured green lawns and rice fields. Bright clear natural sunlight, high contrast, vivid colors, bird\'s eye view perspective.' },
  { id: 'rice_paddy', labelEN: 'Rice Field', labelTH: 'ทุ่งนามุมสูง', prompt: 'A stunning architectural photograph situated in the middle of vast, vibrant green rice paddy fields. Background features a majestic layering mountain range under a bright blue sky. A long straight paved concrete driveway leads from the foreground gate towards the building, flanked by manicured green lawns and rice fields. Bright clear natural sunlight, high contrast, vivid colors, bird\'s eye view perspective.' },
  { id: 'lake_mountain', labelEN: 'Lake Mountain', labelTH: 'ทะเลสาบภูเขา', prompt: 'High-angle bird\'s eye perspective. Bright warm sunlight with sharp shadows. Vibrant blue sky with fluffy white clouds. Rugged mountainous terrain with snow-capped peaks in the distance, forested slopes. A large, reflective deep blue lake in the foreground or middle ground. Meticulously landscaped hillside with green lawns, stone pathways, and a clear blue swimming pool nearby.' },
  { id: 'resort_dusk', labelEN: 'Resort Dusk', labelTH: 'รีสอร์ทยามค่ำ', prompt: 'High-resolution photograph of a resort or residential area at dusk/twilight. Blue-grey sky with wispy clouds. Meticulously designed gardens, lush greenery, large shade trees, pines, shrubs, and colorful flowers. Concrete or stone walkways winding through the garden. Water features or swimming pool reflecting the sky. Asphalt or concrete internal roads with garden lights and warm building lights creating a cozy atmosphere.' },
  { id: 'hillside', labelEN: 'Hillside', labelTH: 'บ้านบนเขา', prompt: 'Vibrant mountain landscape teeming with lush green forests and expansive meadows under a bright cloud-dotted sky. A collection of structures arranged across the hillside. Modern tropical elements with thatch or flat roofs, stone, and wood. Features infinity pools, terraces, wooden walkways, and pavilions. Diverse vegetation and natural setting.' },
  { id: 'lake_front', labelEN: 'Lake Front', labelTH: 'ริมทะเลสาบ', prompt: '8K landscape photograph. Peaceful and fresh waterfront atmosphere. Foreground is a large still lake acting as a mirror reflecting the sky and landscape. Green manicured lawns along the bank, interspersed with gravel and natural stone paths. Background of lush rainforest and large mountains. Soft lighting, scattered clouds. The building sits harmoniously with nature.' },
  { id: 'green_reflection', labelEN: 'Green Reflection', labelTH: 'เงาสะท้อนน้ำ', prompt: 'High-resolution landscape photograph emphasizing tranquility. Foreground is a fresh green lawn, manicured and smooth, leading to the edge of a large lake. Still water surface reflecting the surroundings perfectly. Background of towering mountains covered in dense green rainforest. Big trees framing the water. Diffused soft morning light. The building is placed harmoniously in this setting.' },
  { id: 'khaoyai_1', labelEN: 'Khao Yai 1', labelTH: 'เขาใหญ่ 1', prompt: 'Modern two-story house with distinctive design. Exterior walls mix exposed concrete and black structure with wooden slats. Large floor-to-ceiling glass windows. Located amidst lush natural landscape. Background is a dense forest mountain range. Foreground features a reflecting pool, wide smooth lawn, and flower garden. Morning natural sunlight, peaceful and luxurious.' },
  { id: 'khaoyai_2', labelEN: 'Khao Yai 2', labelTH: 'เขาใหญ่ 2', prompt: 'Modern resort style built of stone and wood, nestled in lush greenery. Tranquil atmosphere. Wide lawn bordered by white and purple flowering plants. A pool reflecting the building. Large trees including mango trees providing shade. Forested mountain backdrop. Afternoon sunlight bathing the scene in a relaxing ambiance.' },
  { id: 'twilight_pool', labelEN: 'Twilight Pool', labelTH: 'สระน้ำพลบค่ำ', prompt: 'Cinematic, photorealistic architectural landscape at twilight (Blue Hour). Foreground features a sleek dark-tiled swimming pool with mirror-like reflections. Wooden deck, built-in lounge seating, dining area. Illuminated by cozy warm golden floor lanterns and interior lights contrasting with the deep blue sky. Lush green hillside background.' }
];

const ARCH_STYLE_PROMPTS: Record<string, string> = {
  modern: "Modern architecture, sleek design, clean lines, glass and concrete materials, geometric shapes, minimalist approach, high-end look",
  contemporary: "Contemporary architecture, fluid lines, asymmetry, eco-friendly materials, natural light integration, innovative design, artistic expression",
  minimal: "Minimalist architecture, extreme simplicity, monochromatic palette, open floor plans, absence of clutter, functional design, zen atmosphere",
  european: "European classic architecture, elegant proportions, ornamental details, stone textures, steep roofs, historic charm, grand facade",
  scandi: "Scandinavian architecture, nordic style, light wood timber, white walls, cozy atmosphere (hygge), functionalism, clean and bright",
  tropical: "Tropical architecture, lush greenery integration, wooden screens, large overhangs, resort vibe, natural ventilation, relaxing atmosphere, exotic materials"
};

const exteriorStyles = [
  { id: 'modern', label: 'Modern' },
  { id: 'contemporary', label: 'Contemporary' },
  { id: 'minimal', label: 'Minimalist' },
  { id: 'european', label: 'European' },
  { id: 'scandi', label: 'Scandinavian' },
  { id: 'tropical', label: 'Tropical' }
];

const RENDER_STYLE_PROMPTS: Record<string, string> = {
  photo: "photorealistic, 4k, highly detailed, realistic texture",
  anime: "anime art style, japanese animation, cel shading, vibrant colors",
  sketch: "pencil sketch, graphite drawing, hand drawn, monochrome, artistic sketch",
  oil: "oil painting style, textured brushstrokes, canvas texture, artistic",
  colorpencil: "colored pencil drawing, soft textures, hand drawn, artistic",
  magic: "magic marker illustration, bold lines, vibrant colors, marker texture"
};

const renderStyles = [
  { id: 'photo', label: 'Photorealistic' },
  { id: 'anime', label: 'Anime' },
  { id: 'sketch', label: 'Sketch' },
  { id: 'oil', label: 'Oil Paint' },
  { id: 'colorpencil', label: 'Color Pencil' },
  { id: 'magic', label: 'Marker' }
];

const TEXTS = {
  EN: {
    exterior: 'Exterior',
    interior: 'Interior',
    plan: 'Plan',
    mainPrompt: 'Description (Optional)',
    negativePrompt: 'Additional Command / Edit', 
    refImage: 'Reference Image (Style)',
    upload: 'Click to upload',
    baseStyle: 'Render Style',
    archStyle: 'Architect Style',
    scene: 'Scene / Atmosphere',
    roomType: 'Room Type',
    interiorStyle: 'Interior Style',
    planStyle: 'Plan Style',
    generate: 'GENERATE',
    generating: 'GENERATING...',
    pro: 'PRO',
    standard: 'Standard',
    download: 'Download',
    resolution: 'High Resolution Output Area',
    mainImagePlaceholder: 'Click to Upload Main Image',
    tools: 'Tools',
    undo: 'Undo',
    redo: 'Redo',
    flip: 'Flip',
    rotate: 'Rotate',
    reset: 'Reset',
    useAsInput: 'Use as Input', 
    alertPrompt: 'Please select a style or enter a description.',
    success: 'Image generated successfully!',
    imageStyle: 'Image Style',
    inputMode: 'Generation Mode',
    modeStandard: 'Standard',
    mode2D: '2D Plan to Room',
    mode3D: '3D Plan to Room',
    dailyQuota: 'Daily Quota',
    quotaLimitReached: 'Daily quota limit reached. Please contact admin.',
    settings: 'Settings',
    customKey: 'Personal Gemini API Key (Optional)',
    customKeyPlaceholder: 'AIza... (Overrides System Key)',
    save: 'Save',
    usingCustomKey: 'Using Personal Key',
    standardMode: 'Standard Mode',
    proMode: 'Pro Mode',
    quotaExceededMsg: 'Daily Quota Exceeded. Switched to Standard Mode.',
    freeModeLabel: 'Standard Mode',
    proModeLabel: 'Pro Mode',
  },
  TH: {
    exterior: 'ภายนอก',
    interior: 'ภายใน',
    plan: 'แปลน',
    mainPrompt: 'คำอธิบาย (ไม่บังคับ)',
    negativePrompt: 'คำสั่งเพิ่มเติม / แก้ไข', 
    refImage: 'รูปภาพอ้างอิง (สไตล์)',
    upload: 'คลิกเพื่ออัพโหลด',
    baseStyle: 'รูปแบบการเรนเดอร์',
    archStyle: 'สไตล์สถาปนิก',
    scene: 'ฉาก / บรรยากาศ',
    roomType: 'ประเภทห้อง',
    interiorStyle: 'สไตล์ตกแต่ง',
    planStyle: 'รูปแบบแปลน',
    generate: 'สร้างรูปภาพ',
    generating: 'กำลังสร้าง...',
    pro: 'โปร',
    standard: 'มาตรฐาน',
    download: 'ดาวน์โหลด',
    resolution: 'พื้นที่แสดงผลความละเอียดสูง (2K)',
    mainImagePlaceholder: 'คลิกเพื่ออัพโหลดรูปหลัก',
    tools: 'เครื่องมือ',
    undo: 'ย้อนกลับ',
    redo: 'ทำซ้ำ',
    flip: 'พลิกภาพ',
    rotate: 'หมุนภาพ',
    reset: 'รีเซ็ต',
    useAsInput: 'ใช้เป็นภาพต้นฉบับ', 
    alertPrompt: 'กรุณาเลือกสไตล์ หรือใส่คำอธิบาย',
    success: 'สร้างรูปภาพเรียบร้อยแล้ว!',
    imageStyle: 'สไตล์ภาพ',
    inputMode: 'โหมดการสร้าง',
    modeStandard: 'ทั่วไป',
    mode2D: 'แปลน 2D เป็นห้อง',
    mode3D: 'แปลน 3D เป็นห้อง',
    dailyQuota: 'โควต้าวันนี้',
    quotaLimitReached: 'โควต้าวันนี้หมดแล้ว กรุณาติดต่อแอดมิน',
    settings: 'ตั้งค่า',
    customKey: 'คีย์ส่วนตัว (ไม่บังคับ)',
    customKeyPlaceholder: 'AIza... (ใช้แทนคีย์กลาง)',
    save: 'บันทึก',
    usingCustomKey: 'ใช้คีย์ส่วนตัว',
    standardMode: 'โหมดมาตรฐาน',
    proMode: 'โหมดโปร',
    quotaExceededMsg: 'โควต้าวันนี้หมดแล้ว เปลี่ยนเป็นโหมดมาตรฐาน',
    freeModeLabel: 'โหมดมาตรฐาน',
    proModeLabel: 'โหมดโปร',
  }
};

export const ImageEditor: React.FC<ImageEditorProps> = ({ user, onLogout, onBackToAdmin }) => {
  // UI State
  const [language, setLanguage] = useState<'EN' | 'TH'>('TH');
  const [activeTab, setActiveTab] = useState<'exterior'|'interior'|'plan'>('exterior');
  const [showSettings, setShowSettings] = useState(false);
  
  // Generation Mode State
  const [generationMode, setGenerationMode] = useState<'standard' | 'pro'>('standard');
  
  // User Data Sync State
  const [currentUserData, setCurrentUserData] = useState<UserData | null>(user);

  // Input State
  const [prompt, setPrompt] = useState('');
  const [additionalCommand, setAdditionalCommand] = useState('');
  
  // Selection State
  const [selectedRenderStyle, setSelectedRenderStyle] = useState('photo'); 
  const [selectedArchStyle, setSelectedArchStyle] = useState(''); 
  const [selectedScene, setSelectedScene] = useState(''); 
  
  // Interior Specific State
  const [selectedRoom, setSelectedRoom] = useState('living');
  const [selectedIntStyle, setSelectedIntStyle] = useState('modern');
  const [interiorMode, setInteriorMode] = useState<'standard' | 'from_2d' | 'from_3d'>('standard');

  // Plan Specific State
  const [selectedPlanStyle, setSelectedPlanStyle] = useState('blueprint');
  
  // Image States
  const [refImage, setRefImage] = useState<string | null>(null);
  const [mainImage, setMainImage] = useState<string | null>(null);
  
  // History State
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  
  // Process State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [warningMsg, setWarningMsg] = useState('');

  // Settings State (Local Storage)
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('user_custom_api_key') || '');

  // Refs
  const refFileInputRef = useRef<HTMLInputElement>(null);
  const mainFileInputRef = useRef<HTMLInputElement>(null);

  const t = TEXTS[language];

  // --- REALTIME USER SYNC ---
  useEffect(() => {
    if (!user || user.id === 'admin') {
      setCurrentUserData(user); // Admin uses static data or what was passed
      return;
    }

    // Subscribe to Firestore updates for this user
    const unsub = onSnapshot(doc(db, "users", user.id), (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data() as UserData;
            // Check for day reset on read
            const today = new Date().toISOString().split('T')[0];
            if (data.lastUsageDate !== today) {
                // Visual reset only, Firestore update happens on next action
                setCurrentUserData({ ...data, id: user.id, usageCount: 0 }); 
            } else {
                setCurrentUserData({ ...data, id: user.id });
            }
        }
    });

    return () => unsub();
  }, [user]);

  // Save custom key to local storage
  const handleSaveCustomKey = () => {
      localStorage.setItem('user_custom_api_key', customApiKey);
      setShowSettings(false);
  };

  // --- HISTORY HELPERS ---
  const addToHistory = (image: string) => {
     const newHistory = history.slice(0, historyStep + 1);
     newHistory.push(image);
     setHistory(newHistory);
     setHistoryStep(newHistory.length - 1);
  };

  const clearHistory = () => {
      setHistory([]);
      setHistoryStep(-1);
  };

  // --- HANDLERS ---
  const handleRefUploadClick = () => {
    if (refImage) {
      setRefImage(null);
      if (refFileInputRef.current) refFileInputRef.current.value = '';
    } else {
      refFileInputRef.current?.click();
    }
  };

  const handleRefFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setRefImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleMainUploadClick = () => {
    if (mainImage) {
      setMainImage(null);
      if (!generatedImage) {
          clearHistory();
      }
      if (mainFileInputRef.current) mainFileInputRef.current.value = '';
    } else {
      mainFileInputRef.current?.click();
    }
  };

  const handleMainFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
          const res = reader.result as string;
          setMainImage(res);
          if (!generatedImage) {
             setHistory([res]);
             setHistoryStep(0);
          }
      };
      reader.readAsDataURL(file);
    }
  };

  // Check if admin quota is available
  const hasPremiumQuota = (): boolean => {
      if (!currentUserData || currentUserData.id === 'admin') return true;

      // FIX: Use nullish coalescing so 0 quota is respected and not defaulted to 10
      const quota = currentUserData.dailyQuota ?? 10;
      const usage = currentUserData.usageCount || 0;
      
      const today = new Date().toISOString().split('T')[0];
      const effectiveUsage = currentUserData.lastUsageDate === today ? usage : 0;

      return effectiveUsage < quota;
  };

  const incrementUsage = async () => {
      if (!currentUserData || currentUserData.id === 'admin') return;
      
      // If user used custom key, do NOT increment usage
      if (customApiKey && customApiKey.length > 10) return;

      const userRef = doc(db, "users", currentUserData.id);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
          const data = userSnap.data() as UserData;
          const today = new Date().toISOString().split('T')[0];
          
          let newCount = (data.usageCount || 0) + 1;
          
          if (data.lastUsageDate !== today) {
              newCount = 1;
          }
          
          await updateDoc(userRef, {
              usageCount: newCount,
              lastUsageDate: today
          });
      }
  };

  const handleGenerate = async () => {
    setErrorMsg('');
    setWarningMsg('');
    
    setIsGenerating(true);

    try {
        // 1. Determine Model & Mode
        // User explicitly wants Pro mode
        const userWantsPro = generationMode === 'pro';
        
        // Can they actually use it? (Quota available OR Custom Key OR Admin)
        const canUsePro = hasPremiumQuota() || (!!customApiKey && customApiKey.length > 10) || currentUserData?.id === 'admin';
        
        let shouldUsePremium = false;
        
        if (userWantsPro) {
            if (canUsePro) {
                shouldUsePremium = true;
            } else {
                 // User wants pro but no quota -> Fallback to standard and warn
                 setWarningMsg(t.quotaExceededMsg);
                 shouldUsePremium = false;
            }
        } else {
            // User explicitly chose Free/Standard mode
            shouldUsePremium = false;
        }
        
        const modelName = shouldUsePremium ? MODEL_PREMIUM : MODEL_STANDARD;
        
        // 2. System API Key Strategy
        // Priority 1: User's Custom Key
        let activeApiKey = customApiKey;

        // Priority 2: Environment Variable
        if (!activeApiKey) {
            activeApiKey = process.env.API_KEY || '';
        }

        // Priority 3: Firestore Global Key
        if (!activeApiKey || activeApiKey === 'undefined') {
             try {
                 const settingsRef = doc(db, "settings", "global");
                 const settingsSnap = await getDoc(settingsRef);
                 if (settingsSnap.exists()) {
                     activeApiKey = settingsSnap.data().geminiApiKey;
                 }
             } catch (e) {
                 console.error("Failed to fetch key from DB", e);
             }
        }

        if (!activeApiKey) {
            setErrorMsg("System Error: Admin API Key is not configured. Please contact admin.");
            setIsGenerating(false);
            return;
        }

    
      // 3. Validation
      if (activeTab === 'exterior' && !prompt && !selectedArchStyle && !selectedScene && !mainImage && !refImage) {
        setErrorMsg(t.alertPrompt);
        setIsGenerating(false);
        return;
      }

      const genAI = new GoogleGenAI({ apiKey: activeApiKey }); 
      
      let fullPrompt = "";
      const renderStyleKeyword = RENDER_STYLE_PROMPTS[selectedRenderStyle] || RENDER_STYLE_PROMPTS['photo'];

      if (activeTab === 'interior') {
         const room = ROOM_TYPES.find(r => r.id === selectedRoom);
         const style = INTERIOR_STYLES.find(s => s.id === selectedIntStyle);
         if (interiorMode === 'from_2d' && mainImage) {
             fullPrompt = `Transform this 2D floor plan into a highly realistic 3D interior perspective view. Extrude the walls, add a ceiling, and render the room from an eye-level human perspective. IMPORTANT: You must strictly adhere to the furniture positions shown in the plan. Do not add new furniture and do not remove existing furniture. Keep the layout exactly as is. Apply realistic materials (flooring, wall paint) and lighting. `;
         } else if (interiorMode === 'from_3d' && mainImage) {
             fullPrompt = `Transform this 3D architectural plan/section into a highly realistic interior perspective view. IMPORTANT: You must strictly adhere to the furniture positions shown in the image. Do not add new furniture and do not remove existing furniture. Enhance textures, lighting, and details to make it look like a real photo. `;
         } else {
             fullPrompt = `Generate a high quality interior design image. `;
         }
         if (room) fullPrompt += `${room.prompt}. `;
         if (style) fullPrompt += `${style.prompt}. `;
         if (prompt) fullPrompt += `Additional Details: ${prompt}. `;
         fullPrompt += `Render Style: ${renderStyleKeyword}. `;

      } else if (activeTab === 'plan') {
         const planStyle = PLAN_STYLES.find(p => p.id === selectedPlanStyle);
         fullPrompt = `Generate a high quality architectural floor plan. `;
         if (planStyle) fullPrompt += `${planStyle.prompt}. `;
         if (prompt) fullPrompt += `Description: ${prompt}. `;
         fullPrompt += `Render Style: ${renderStyleKeyword}. `;

      } else {
         fullPrompt = `Generate a high quality image of exterior view. `;
         if (selectedScene) {
           const scene = EXTERIOR_SCENES.find(s => s.id === selectedScene);
           if (scene) fullPrompt += `${scene.prompt} `;
         }
         if (selectedArchStyle && ARCH_STYLE_PROMPTS[selectedArchStyle]) {
            fullPrompt += `Architecture Style: ${ARCH_STYLE_PROMPTS[selectedArchStyle]}. `;
         } else if (selectedArchStyle) {
            fullPrompt += `Architecture Style: ${selectedArchStyle}. `;
         }
         if (prompt) fullPrompt += `Additional Details: ${prompt}. `;
         fullPrompt += `Render Style: ${renderStyleKeyword}. `;
      }

      if (mainImage) {
          if (activeTab === 'plan') {
              if (selectedPlanStyle === 'iso_structure') {
                   fullPrompt += " [Instruction]: STRICT CONVERSION. Convert this 2D plan into a 3D Isometric view. You MUST preserve the exact wall layout, proportions, and furniture placement of the source image. Do not change the design. Only change the perspective to 3D Isometric.";
              } else {
                   fullPrompt += " [Instruction]: Analyze this image (sketch or plan). Redraw it as a high-quality floor plan in the specified style, maintaining the layout but enhancing clarity and aesthetics.";
              }
          } else if (activeTab === 'interior' && interiorMode !== 'standard') {
              // Handled above
          } else {
              fullPrompt += " [STRICT CONSTRAINT]: Preserve the original image style, camera angle, composition, and lighting exactly. Do not change the overall look. ";
              if (additionalCommand) {
                  fullPrompt += `ACTION: Add or modify elements based strictly on this command: "${additionalCommand}". Do not remove existing elements unless asked. `;
              } else if (prompt) {
                  fullPrompt += `ACTION: Edit based on: "${prompt}". Keep everything else exactly the same. `;
              }
          }
      } else {
          if (additionalCommand) {
              fullPrompt += `Additional details: ${additionalCommand}. `;
          }
      }
      
      fullPrompt += `Exclude: ${DEFAULT_NEGATIVE_PROMPT}.`;
      
      if (mainImage && refImage) {
         fullPrompt += " [Instruction]: Use the first image as the main structural base. Use the second image as a reference for style. Blend the aesthetic of the second image into the first image.";
      } else if (mainImage) {
         if (activeTab === 'plan') {
         } else if (activeTab === 'interior' && (interiorMode === 'from_2d' || interiorMode === 'from_3d')) {
             fullPrompt += " [Instruction]: Strictly follow the furniture layout and structure of the provided image.";
         } else {
            fullPrompt += " [Instruction]: You must use the provided image as the strict reference for composition. DO NOT change the style. DO NOT change the overall structure.";
         }
      } else if (refImage) {
         fullPrompt += " [Instruction]: Use this image as a style reference.";
      }

      const parts: any[] = [{ text: fullPrompt }];
      if (mainImage) {
         parts.push({ inlineData: { data: mainImage.split(',')[1], mimeType: "image/png" } });
      }
      if (refImage) {
         parts.push({ inlineData: { data: refImage.split(',')[1], mimeType: "image/png" } });
      }

      // Check specific configs for models
      const generateConfig: any = { };
      if (shouldUsePremium) {
           generateConfig.imageConfig = { imageSize: '2K', aspectRatio: '16:9' };
      }

      const response = await genAI.models.generateContent({
        model: modelName,
        contents: { parts },
        config: generateConfig
      });

      const candidate = response.candidates?.[0];
      let foundImage = false;

      if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
              if (part.inlineData) {
                  const newImg = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                  setGeneratedImage(newImg);
                  setHistory([newImg]);
                  setHistoryStep(0);
                  foundImage = true;
                  
                  // SUCCESS: Deduct Quota ONLY if using Premium and NOT custom key and NOT admin
                  if (shouldUsePremium && !customApiKey && currentUserData?.id !== 'admin') {
                      await incrementUsage();
                  } 
                  break;
              }
          }
      }
      
      if (!foundImage) {
        throw new Error("No image generated.");
      }

    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes("Requested entity was not found")) {
         setErrorMsg("System API Key Issue. Please contact admin.");
      } else if (err.message && (err.message.includes("429") || err.message.includes("Quota exceeded"))) {
         setErrorMsg("System busy (Quota exceeded). Please try again later.");
      } else {
         setErrorMsg(err.message || "Failed to generate image.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setGeneratedImage(null);
    setPrompt('');
    setAdditionalCommand('');
    setRefImage(null);
    setSelectedScene('');
    setInteriorMode('standard');
    if (mainImage) {
        setHistory([mainImage]);
        setHistoryStep(0);
    } else {
        clearHistory();
    }
    if (refFileInputRef.current) refFileInputRef.current.value = '';
    setErrorMsg('');
    setWarningMsg('');
  };

  const handleUseAsInput = () => {
    if (generatedImage) {
      setMainImage(generatedImage);
      setGeneratedImage(null);
      setHistory([generatedImage]);
      setHistoryStep(0);
      if (mainFileInputRef.current) mainFileInputRef.current.value = '';
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `generated-ai-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleUndo = () => {
      if (historyStep > 0) {
          const prevIndex = historyStep - 1;
          const prevImage = history[prevIndex];
          setHistoryStep(prevIndex);
          if (generatedImage) setGeneratedImage(prevImage);
          else if (mainImage) setMainImage(prevImage);
      }
  };

  const handleRedo = () => {
      if (historyStep < history.length - 1) {
          const nextIndex = historyStep + 1;
          const nextImage = history[nextIndex];
          setHistoryStep(nextIndex);
          if (generatedImage) setGeneratedImage(nextImage);
          else if (mainImage) setMainImage(nextImage);
      }
  };

  const handleRotate = async () => {
      const activeImage = generatedImage || mainImage;
      if (!activeImage) return;
      setIsGenerating(true);
      try {
          const newImg = await transformImage(activeImage, 'rotate');
          if (generatedImage) setGeneratedImage(newImg);
          else setMainImage(newImg);
          addToHistory(newImg);
      } finally {
          setIsGenerating(false);
      }
  };

  const handleFlip = async () => {
      const activeImage = generatedImage || mainImage;
      if (!activeImage) return;
      setIsGenerating(true);
      try {
          const newImg = await transformImage(activeImage, 'flip');
          if (generatedImage) setGeneratedImage(newImg);
          else setMainImage(newImg);
          addToHistory(newImg);
      } finally {
          setIsGenerating(false);
      }
  };

  // QUOTA UI DATA
  // FIX: Use nullish coalescing to respect 0 quota
  const quota = currentUserData?.dailyQuota ?? 10;
  const usage = currentUserData?.usageCount || 0;
  // isProMode = Has Quota OR Custom Key
  const hasQuota = hasPremiumQuota();
  const isProMode = hasQuota || (!!customApiKey && customApiKey.length > 10);
  const usagePercent = Math.min((usage / quota) * 100, 100);

  // Helper for Plan Name
  const getPlanName = (q: number) => {
      if (q >= 500) return 'ENTERPRISE';
      if (q >= 50) return 'PRO PLAN';
      if (q >= 1) return 'STARTER';
      return 'FREE';
  };

  const planName = getPlanName(quota);

  return (
    <div className="h-screen w-full flex flex-col bg-gray-950 text-gray-200 font-sans overflow-hidden">
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                   <Settings className="w-5 h-5 text-indigo-400" />
                   {t.settings}
                </h3>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white transition-colors">
                   <X className="w-5 h-5" />
                </button>
             </div>
             <div className="p-6 space-y-4">
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3">
                   <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                   <p className="text-xs text-indigo-200 leading-relaxed">
                      If you have your own Google Gemini API Key, you can enter it here. 
                      It will take priority over the system quota, allowing unlimited generation based on your key's limits.
                   </p>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.customKey}</label>
                   <div className="relative">
                      <Key className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <input 
                         type="password"
                         value={customApiKey}
                         onChange={(e) => setCustomApiKey(e.target.value)}
                         className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                         placeholder={t.customKeyPlaceholder}
                      />
                   </div>
                </div>
             </div>
             <div className="p-5 border-t border-slate-800 flex justify-end gap-2">
                <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                   Cancel
                </button>
                <button onClick={handleSaveCustomKey} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-indigo-500/20">
                   {t.save}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <header className="h-16 border-b border-gray-800 bg-gray-900/90 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">Professional AI</h1>
            <div className="flex items-center gap-2 mt-0.5">
               <span className={`w-1.5 h-1.5 rounded-full ${hasQuota ? 'bg-indigo-500' : 'bg-amber-500'}`}></span>
               <p className="text-[10px] text-gray-400 font-medium">
                {currentUserData?.username || 'Guest'}
               </p>
               <span className="text-[10px] text-gray-600">•</span>
               {generationMode === 'pro' && isProMode ? (
                  <p className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 tracking-wide">
                    {planName}
                  </p>
               ) : (
                  <p className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 tracking-wide flex items-center gap-1">
                    <BatteryWarning className="w-3 h-3" />
                    {language === 'EN' ? 'STANDARD MODE' : 'โหมดมาตรฐาน'}
                  </p>
               )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onBackToAdmin && (
             <button onClick={onBackToAdmin} className="hidden md:flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-indigo-500/20 border border-indigo-500/30">
                <LayoutDashboard className="w-3.5 h-3.5" />
                Admin
             </button>
          )}
          <div className="h-6 w-px bg-gray-800 mx-1"></div>
          
          <button onClick={() => setShowSettings(true)} className={`flex items-center gap-1.5 text-xs font-medium transition-colors px-3 py-1.5 rounded-lg border ${customApiKey ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'text-gray-400 hover:text-white hover:bg-gray-800 border-transparent'}`}>
            <Settings className="w-3.5 h-3.5" /> 
            {customApiKey ? t.usingCustomKey : t.settings}
          </button>

          <button onClick={() => setLanguage(l => l === 'EN' ? 'TH' : 'EN')} className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800">
            <Globe className="w-3.5 h-3.5" /> {language}
          </button>
          
          <button onClick={onLogout} className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar (Tools) */}
        <aside className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 z-20">
          
          {/* USER QUOTA BAR & MODE SELECTOR */}
          <div className="px-4 pt-4 pb-2 space-y-3">
             <div className="grid grid-cols-2 gap-1 p-1 bg-gray-950/50 rounded-xl border border-gray-800">
                <button
                    onClick={() => setGenerationMode('standard')}
                    className={`py-2 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition-all ${
                        generationMode === 'standard' 
                        ? 'bg-gray-800 text-white shadow-md border border-gray-700' 
                        : 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-300'
                    }`}
                >
                    <Zap className={`w-3.5 h-3.5 ${generationMode === 'standard' ? 'text-amber-400' : 'text-gray-600'}`} />
                    {t.freeModeLabel}
                </button>
                <button
                    onClick={() => setGenerationMode('pro')}
                    className={`py-2 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition-all ${
                        generationMode === 'pro' 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
                        : 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-300'
                    }`}
                >
                    <Crown className={`w-3.5 h-3.5 ${generationMode === 'pro' ? 'text-white' : 'text-gray-600'}`} />
                    {t.proModeLabel}
                </button>
             </div>

             {currentUserData?.id !== 'admin' && (
                 <div className={`bg-gray-950/50 rounded-xl p-3 border border-gray-800 transition-all duration-300 ${generationMode === 'standard' ? 'opacity-50 grayscale' : 'opacity-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <Zap className="w-3 h-3 text-indigo-400" />
                            {planName} QUOTA
                        </span>
                        <span className={`text-[10px] font-bold ${hasQuota ? 'text-white' : 'text-red-400'}`}>
                            {customApiKey ? '∞' : usage} / {customApiKey ? '∞' : quota}
                        </span>
                    </div>
                    {customApiKey ? (
                         <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                             <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 w-full animate-pulse"></div>
                         </div>
                    ) : (
                        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                             <div 
                               className={`h-full rounded-full transition-all duration-500 ${hasQuota ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-red-500'}`} 
                               style={{width: `${usagePercent}%`}}
                             ></div>
                        </div>
                    )}
                    {customApiKey ? (
                      <p className="text-[9px] text-indigo-400 mt-1.5 text-center">* Using Personal API Key</p>
                    ) : !hasQuota ? (
                      <p className="text-[9px] text-amber-400 mt-1.5 text-center flex items-center justify-center gap-1">
                         <BatteryWarning className="w-3 h-3" /> Switched to Standard Mode
                      </p>
                    ) : null}
                 </div>
             )}
          </div>

          {/* Mode Tabs */}
          <div className="px-4 py-2 shrink-0">
            <div className="grid grid-cols-3 gap-1 p-1 bg-gray-950/50 rounded-xl border border-gray-800">
              {[
                { id: 'exterior', label: t.exterior, icon: Home },
                { id: 'interior', label: t.interior, icon: Box },
                { id: 'plan', label: t.plan, icon: Layout }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`relative flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 overflow-hidden group ${
                    activeTab === tab.id 
                      ? 'text-white shadow-md' 
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                >
                  {activeTab === tab.id && (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-600 opacity-100"></div>
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-white' : 'text-current'}`} />
                    <span className="truncate">{tab.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                  {t.mainPrompt}
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-20 bg-gray-950 border border-gray-700 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-700 resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  placeholder={language === 'EN' ? "Additional details..." : "รายละเอียดเพิ่มเติม..."}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                  {t.negativePrompt}
                </label>
                <textarea
                  value={additionalCommand}
                  onChange={(e) => setAdditionalCommand(e.target.value)}
                  className="w-full h-20 bg-gray-950 border border-gray-700 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-700 resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition-all"
                  placeholder={language === 'EN' ? "e.g., Make it night time, Add a red car..." : "เช่น เปลี่ยนเป็นกลางคืน, เติมรถสีแดง..."}
                />
              </div>

              <div className="space-y-1.5">
                 <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                  {t.refImage}
                </label>
                <div 
                  onClick={handleRefUploadClick}
                  className={`flex flex-col items-center justify-center w-full h-16 border-2 border-dashed rounded-xl cursor-pointer transition-all group relative overflow-hidden ${refImage ? 'border-indigo-500 bg-gray-900' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/50'}`}
                >
                  {refImage ? (
                    <>
                      <img src={refImage} alt="Reference" className="w-full h-full object-cover opacity-60" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <Trash2 className="w-5 h-5 text-white drop-shadow-md" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <Upload className="w-4 h-4 text-gray-600 mb-1" />
                      <span className="text-[10px] text-gray-500">{t.upload}</span>
                    </div>
                  )}
                  <input ref={refFileInputRef} type="file" className="hidden" accept="image/*" onChange={handleRefFileUpload} onClick={(e) => e.stopPropagation()} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                  <Brush className="w-3 h-3" /> {t.imageStyle}
                </label>
                <div className="grid grid-cols-3 gap-0.5">
                  {renderStyles.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedRenderStyle(selectedRenderStyle === style.id ? '' : style.id)}
                      className={`py-1 rounded-lg text-[10px] font-medium flex items-center justify-center border transition-all duration-200 ${
                        selectedRenderStyle === style.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-md'
                          : 'bg-gray-950 border-gray-800 text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-4 border-t border-gray-800">
                {activeTab === 'interior' && (
                   <div className="space-y-2">
                     <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                         <Box className="w-3 h-3" /> {t.roomType}
                       </label>
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                       {ROOM_TYPES.map((room) => (
                         <button
                           key={room.id}
                           onClick={() => setSelectedRoom(selectedRoom === room.id ? '' : room.id)}
                           className={`py-3 px-3 rounded-lg text-xs font-medium transition-all border flex items-center gap-2 ${
                             selectedRoom === room.id
                               ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                               : 'bg-gray-950 border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                           }`}
                         >
                           <room.icon className={`w-4 h-4 ${selectedRoom === room.id ? 'text-indigo-400' : 'text-gray-600'}`} />
                           {language === 'TH' ? room.labelTH : room.labelEN}
                         </button>
                       ))}
                     </div>
                   </div>
                )}
                
                {activeTab === 'interior' && (
                   <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                         <Cuboid className="w-3 h-3" /> {t.inputMode}
                       </label>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                         <button
                           onClick={() => setInteriorMode('standard')}
                           className={`py-2 px-1 rounded-lg text-[10px] font-medium border flex flex-col items-center gap-1 ${
                             interiorMode === 'standard'
                               ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                               : 'bg-gray-950 border-gray-800 text-gray-500 hover:border-gray-700'
                           }`}
                         >
                            <ImageIcon className="w-4 h-4" />
                            {t.modeStandard}
                         </button>
                         <button
                           onClick={() => setInteriorMode('from_2d')}
                           className={`py-2 px-1 rounded-lg text-[10px] font-medium border flex flex-col items-center gap-1 ${
                             interiorMode === 'from_2d'
                               ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                               : 'bg-gray-950 border-gray-800 text-gray-500 hover:border-gray-700'
                           }`}
                         >
                            <FileText className="w-4 h-4" />
                            {t.mode2D}
                         </button>
                         <button
                           onClick={() => setInteriorMode('from_3d')}
                           className={`py-2 px-1 rounded-lg text-[10px] font-medium border flex flex-col items-center gap-1 ${
                             interiorMode === 'from_3d'
                               ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                               : 'bg-gray-950 border-gray-800 text-gray-500 hover:border-gray-700'
                           }`}
                         >
                            <Cuboid className="w-4 h-4" />
                            {t.mode3D}
                         </button>
                      </div>
                   </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                     <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                      <Palette className="w-3 h-3" /> 
                      {activeTab === 'interior' ? t.interiorStyle : activeTab === 'plan' ? t.planStyle : activeTab === 'exterior' ? t.archStyle : ''}
                    </label>
                    <span className="text-[9px] font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-2 py-0.5 rounded-full">PRO</span>
                  </div>
                  
                  {activeTab === 'interior' ? (
                      <div className="grid grid-cols-2 gap-1">
                        {INTERIOR_STYLES.map((style) => (
                          <button
                            key={style.id}
                            onClick={() => setSelectedIntStyle(selectedIntStyle === style.id ? '' : style.id)}
                            className={`py-1.5 px-2 rounded-lg text-xs text-left font-medium transition-all border relative overflow-hidden ${
                              selectedIntStyle === style.id
                                ? 'bg-gray-800 text-white border-indigo-500 shadow-md'
                                : 'bg-gray-950 border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                            }`}
                          >
                             <div className={`absolute left-0 top-0 bottom-0 w-1 ${selectedIntStyle === style.id ? 'bg-indigo-500' : 'bg-transparent'}`}></div>
                             {language === 'TH' ? style.labelTH : style.labelEN}
                          </button>
                        ))}
                      </div>
                  ) : activeTab === 'plan' ? (
                      <div className="grid grid-cols-2 gap-1">
                        {PLAN_STYLES.map((style) => (
                          <button
                            key={style.id}
                            onClick={() => setSelectedPlanStyle(selectedPlanStyle === style.id ? '' : style.id)}
                            className={`py-1.5 px-2 rounded-lg text-xs text-left font-medium transition-all border relative overflow-hidden ${
                              selectedPlanStyle === style.id
                                ? 'bg-gray-800 text-white border-indigo-500 shadow-md'
                                : 'bg-gray-950 border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                            }`}
                          >
                             <div className={`absolute left-0 top-0 bottom-0 w-1 ${selectedPlanStyle === style.id ? 'bg-indigo-500' : 'bg-transparent'}`}></div>
                             {language === 'TH' ? style.labelTH : style.labelEN}
                          </button>
                        ))}
                      </div>
                  ) : activeTab === 'exterior' ? (
                      <div className="grid grid-cols-2 gap-1">
                        {exteriorStyles.map((style) => (
                          <button
                            key={style.id}
                            onClick={() => setSelectedArchStyle(style.id === selectedArchStyle ? '' : style.id)}
                            className={`py-1.5 px-2 rounded-lg text-xs text-left font-medium transition-all border relative overflow-hidden ${
                              selectedArchStyle === style.id
                                ? 'bg-gray-800 text-white border-indigo-500 shadow-md'
                                : 'bg-gray-950 border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                            }`}
                          >
                             <div className={`absolute left-0 top-0 bottom-0 w-1 ${selectedArchStyle === style.id ? 'bg-indigo-500' : 'bg-transparent'}`}></div>
                            {style.label}
                          </button>
                        ))}
                      </div>
                  ) : null}
                </div>

                {activeTab === 'exterior' && (
                  <div className="space-y-2 flex-1 flex flex-col">
                    <div className="flex items-center justify-between shrink-0">
                       <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <Mountain className="w-3 h-3" /> {t.scene}
                      </label>
                      <span className="text-[9px] font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-2 py-0.5 rounded-full">NEW</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1 pb-2">
                      {EXTERIOR_SCENES.map((scene) => (
                        <button
                          key={scene.id}
                          onClick={() => setSelectedScene(scene.id === selectedScene ? '' : scene.id)}
                          className={`py-2 px-2 rounded-lg text-[10px] text-left font-medium transition-all border relative overflow-hidden flex items-center ${
                            selectedScene === scene.id
                              ? 'bg-gray-800 text-white border-emerald-500 shadow-sm'
                              : 'bg-gray-950 border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                          }`}
                        >
                           <div className={`absolute left-0 top-0 bottom-0 w-1 ${selectedScene === scene.id ? 'bg-emerald-500' : 'bg-transparent'}`}></div>
                           <span className={`pl-1 truncate ${selectedScene === scene.id ? 'text-emerald-300' : ''}`}>{language === 'TH' ? scene.labelTH : scene.labelEN}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
            </div>
            
            <div className="h-2"></div>
          </div>

          <div className="p-4 bg-gray-900 border-t border-gray-800 shrink-0 z-10 space-y-3">
            {warningMsg && (
               <div className="flex items-start gap-2 text-amber-400 text-xs bg-amber-950/30 p-3 rounded-lg border border-amber-900/50">
                <BatteryWarning className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-tight">{warningMsg}</span>
              </div>
            )}
            {errorMsg && (
              <div className="flex items-start gap-2 text-red-400 text-xs bg-red-950/30 p-3 rounded-lg border border-red-900/50">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-tight">{errorMsg}</span>
              </div>
            )}

            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full font-bold py-4 rounded-xl shadow-lg transition-all transform active:scale-[0.98] border relative overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border-indigo-400/20 shadow-indigo-900/40"
            >
              <div className={`absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 blur-xl`}></div>
              <span className="relative flex items-center justify-center gap-2 tracking-wide">
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.generating}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {generationMode === 'pro' && isProMode ? t.generate : t.standard}
                  </>
                )}
              </span>
            </button>
          </div>
        </aside>

        <main className="flex-1 bg-black flex flex-col relative h-full">
          <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black h-full">
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
                 style={{ 
                   backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', 
                   backgroundSize: '40px 40px' 
                 }} 
            />
            
            <div 
              onClick={() => !generatedImage && handleMainUploadClick()}
              className={`relative z-10 w-full h-full flex flex-col items-center justify-center text-gray-700 group transition-all duration-300 shadow-2xl backdrop-blur-sm overflow-hidden border-2 border-dashed ${!generatedImage ? 'cursor-pointer border-gray-800 hover:border-gray-600 hover:bg-gray-900/50 rounded-2xl' : 'border-transparent bg-transparent'}`}
            >
              <input 
                 ref={mainFileInputRef}
                 type="file" 
                 className="hidden" 
                 accept="image/*" 
                 onChange={handleMainFileUpload}
                 onClick={(e) => e.stopPropagation()} 
              />
              
              {generatedImage ? (
                 <img src={generatedImage} alt="Generated AI Art" className="max-w-full max-h-full object-contain animate-in fade-in zoom-in duration-500 shadow-2xl" />
              ) : mainImage ? (
                 <div className="relative w-full h-full flex items-center justify-center">
                    <img src={mainImage} alt="Main Subject" className="max-w-full max-h-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                       <div className="flex flex-col items-center gap-2 text-white">
                          <div className="bg-red-500/80 p-3 rounded-full backdrop-blur-sm shadow-lg transform scale-90 group-hover:scale-100 transition-transform cursor-pointer" onClick={(e) => { e.stopPropagation(); setMainImage(null); if(mainFileInputRef.current) mainFileInputRef.current.value = ''; }}>
                             <Trash2 className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-medium drop-shadow-md">Click to Remove Main Image</p>
                       </div>
                    </div>
                    <div className="absolute top-4 left-4 bg-indigo-600/80 backdrop-blur text-white text-[10px] font-bold px-3 py-1 rounded-full border border-indigo-400/30 shadow-lg z-10">MAIN IMAGE</div>
                 </div>
              ) : (
                <>
                  <div className="absolute top-4 left-4 flex gap-2">
                     <div className="bg-black/50 backdrop-blur-md text-gray-400 text-[10px] px-2 py-1 rounded border border-white/5">FULL CANVAS</div>
                  </div>
                  <div className="text-center group-hover:scale-105 transition-transform duration-500">
                    <div className="flex justify-center mb-4">
                       <div className="w-20 h-20 rounded-full bg-gray-800/50 flex items-center justify-center group-hover:bg-indigo-500/10 transition-colors">
                           <PictureIcon className="w-10 h-10 text-gray-600 group-hover:text-indigo-400 transition-colors" />
                       </div>
                    </div>
                    <span className="text-5xl font-black text-white/5 select-none block group-hover:text-indigo-500/10 transition-colors">2K</span>
                    <p className="mt-4 text-sm font-medium tracking-wide text-gray-500 group-hover:text-indigo-300 transition-colors">{t.mainImagePlaceholder}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="h-20 bg-gray-900 border-t border-gray-800 px-8 flex items-center justify-center relative z-20 shrink-0">
             <div className="flex items-center gap-2 bg-gray-800/80 backdrop-blur-md p-2 rounded-2xl border border-gray-700/50 shadow-xl">
                <ToolButton icon={Undo2} tooltip={t.undo} onClick={handleUndo} disabled={historyStep <= 0} />
                <ToolButton icon={Redo2} tooltip={t.redo} onClick={handleRedo} disabled={historyStep >= history.length - 1} />
                <div className="w-px h-6 bg-gray-700 mx-1"></div>
                <ToolButton icon={FlipHorizontal} tooltip={t.flip} onClick={handleFlip} disabled={!generatedImage && !mainImage} />
                <ToolButton icon={RotateCw} tooltip={t.rotate} onClick={handleRotate} disabled={!generatedImage && !mainImage} />
                <div className="w-px h-6 bg-gray-700 mx-1"></div>
                <ToolButton icon={ArrowUp} tooltip={t.useAsInput} onClick={handleUseAsInput} disabled={!generatedImage} />
                <ToolButton icon={RefreshCcw} tooltip={t.reset} onClick={handleReset} />
                <div className="w-px h-6 bg-transparent mx-2"></div>
                <button 
                  onClick={handleDownload}
                  disabled={!generatedImage}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-900/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  {t.download}
                </button>
             </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const ToolButton: React.FC<{ icon: React.ElementType, tooltip: string, onClick?: () => void, disabled?: boolean }> = ({ icon: Icon, tooltip, onClick, disabled }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`p-2.5 rounded-xl transition-all relative group ${disabled ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-700 active:scale-90'}`}
    title={tooltip}
  >
    <Icon className="w-5 h-5" />
    <span className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 transition-opacity whitespace-nowrap pointer-events-none border border-white/10 ${disabled ? 'hidden' : 'group-hover:opacity-100'}`}>
      {tooltip}
    </span>
  </button>
);