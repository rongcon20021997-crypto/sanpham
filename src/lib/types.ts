export type UserRole = "admin" | "staff";
export type UserStatus = "active" | "disabled";

export interface Profile {
  id: string;
  email: string;
  username?: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export interface Color {
  id: number;
  code: string;
  name: string;
  hex: string | null;
  prompt_front?: string | null;
  prompt_back?: string | null;
}

export interface Size {
  id: number;
  code: string;
  name: string;
  sort_order: number;
}

export interface Theme {
  id: number;
  name: string;
}

export interface CodeRule {
  id: number;
  template: string;
  description: string | null;
}

export interface BlankType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Blank {
  id: string;
  code: string;
  blank_type_id: string;
  color: string;
  size: string;
  price: number;
  image_url: string | null;
  image_back_url?: string | null;
  created_at: string;
  blank_types?: BlankType;
}

export interface PrintDesign {
  id: string;
  code: string;
  name: string;
  theme: string | null;
  png_url: string | null;
  thumbnail_url: string | null;
  tags: string[] | null;
  notes: string | null;
  is_back?: boolean | null;
  created_at: string;
}

export interface PrintPositionData {
  posX: number;
  posY: number;
  scale: number;
  visible?: boolean;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  master_name?: string | null;
  master_code?: string | null;
  images?: string[] | null;
  video_url?: string | null;
  blank_id: string;
  print_design_id: string;
  print_design_ids?: string[] | null;
  preview_url: string | null;
  blank_image_type?: "front" | "combined" | string | null;
  print_position?: PrintPositionData | null;
  print_positions?: Record<string, PrintPositionData> | null;
  price: number;
  status: "active" | "inactive";
  is_optimized?: boolean | null;
  shopee_name?: string | null;
  shopee_description?: string | null;
  optimized_at?: string | null;
  created_at: string;
  blanks?: Blank;
  print_designs?: PrintDesign;
  all_print_designs?: PrintDesign[];
}

export interface BlankWithRelations extends Blank {
  blank_types?: BlankType;
}

export interface ProductWithRelations extends Product {
  blanks?: Blank;
  print_designs?: PrintDesign;
}

export interface LogoItem {
  id: string;
  code: string;
  name: string;
  image_url: string;
  created_at?: string;
}

export interface AIPrompt {
  id: string;
  title: string;
  prompt: string;
  side: "all" | "front" | "back";
  category?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

