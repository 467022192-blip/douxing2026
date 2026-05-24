export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      attractions: {
        Row: {
          id: string;
          name: string;
          province: string;
          city: string;
          address: string | null;
          description: string | null;
          features: string | null;
          tips: string | null;
          ticket_price: number | null;
          open_time: string | null;
          latitude: number;
          longitude: number;
          image_url: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          province: string;
          city: string;
          address?: string | null;
          description?: string | null;
          features?: string | null;
          tips?: string | null;
          ticket_price?: number | null;
          open_time?: string | null;
          latitude: number;
          longitude: number;
          image_url?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          province?: string;
          city?: string;
          address?: string | null;
          description?: string | null;
          features?: string | null;
          tips?: string | null;
          ticket_price?: number | null;
          open_time?: string | null;
          latitude?: number;
          longitude?: number;
          image_url?: string | null;
          created_at?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          nickname: string;
          avatar_url: string | null;
          is_private: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          phone?: string | null;
          nickname?: string;
          avatar_url?: string | null;
          is_private?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          phone?: string | null;
          nickname?: string;
          avatar_url?: string | null;
          is_private?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      user_checkins: {
        Row: {
          id: string;
          user_id: string;
          attraction_id: string;
          status: string;
          visit_count: number;
          visited_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          attraction_id: string;
          status: string;
          visit_count?: number;
          visited_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          attraction_id?: string;
          status?: string;
          visit_count?: number;
          visited_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          attraction_id: string;
          content: string | null;
          images: Json;
          is_private: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          attraction_id: string;
          content?: string | null;
          images?: Json;
          is_private?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          attraction_id?: string;
          content?: string | null;
          images?: Json;
          is_private?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          created_at?: string | null;
        };
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          content: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          content: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          content?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
