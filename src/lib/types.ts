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
  created_at: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  blank_id: string;
  print_design_id: string;
  preview_url: string | null;
  price: number;
  status: "active" | "inactive";
  created_at: string;
  blanks?: Blank;
  print_designs?: PrintDesign;
}

export interface BlankWithRelations extends Blank {
  blank_types?: BlankType;
}

export interface ProductWithRelations extends Product {
  blanks?: Blank;
  print_designs?: PrintDesign;
}
