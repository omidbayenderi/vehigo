export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UserRole = "owner" | "broker" | "assistant";
export type VatStatus = "vat_included" | "vat_free" | "margin_scheme" | "unknown";
export type VehicleType = "truck" | "trailer" | "construction" | "spare_part" | "bus" | "other";
export type VehicleCondition = "new" | "used_excellent" | "used_good" | "used_fair" | "damaged";
export type AvailabilityStatus = "available" | "reserved" | "sold" | "expired";
export type LeadSource = "instagram" | "telegram" | "divar" | "sheypoor" | "google_maps" | "referral" | "manual";
export type LeadStatus =
  | "new"
  | "contacted"
  | "interested"
  | "vehicle_proposed"
  | "offer_sent"
  | "deposit_requested"
  | "in_progress"
  | "closed_won"
  | "closed_lost";
export type CommissionType = "fixed" | "percentage";
export type OfferStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type MessageChannel = "whatsapp" | "telegram" | "instagram";
export type MessageStatus = "draft" | "approved" | "sent" | "discarded";
export type MarketSourceStatus = "idle" | "ok" | "failed" | "blocked" | "skipped";
export type MarketSourceMethod = "scrape" | "email_alert";
export type ListingAlertStatus = "pending" | "sent" | "failed" | "skipped";
export type ScannerRunStatus = "ok" | "failed" | "blocked" | "skipped";

export type Database = {
  public: {
    Tables: {
      users_profile: {
        Row: {
          id: string;
          full_name: string | null;
          role: UserRole;
          telegram_username: string | null;
          telegram_chat_id: string | null;
          telegram_verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: UserRole;
          telegram_username?: string | null;
          telegram_chat_id?: string | null;
          telegram_verified_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users_profile"]["Insert"]>;
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          source_site: string | null;
          listing_url: string | null;
          seller_name: string | null;
          seller_country: string | null;
          brand: string | null;
          model: string | null;
          year: number | null;
          mileage_km: number | null;
          price: number | null;
          currency: string;
          vat_status: VatStatus | null;
          vehicle_type: VehicleType | null;
          tech_specs: Json | null;
          euro_class: string | null;
          condition: VehicleCondition | null;
          availability_status: AvailabilityStatus;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["vehicles"]["Row"]> & {
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Row"]>;
        Relationships: [];
      };
      vehicle_images: {
        Row: {
          id: string;
          vehicle_id: string;
          storage_path: string;
          is_primary: boolean;
          sort_order: number;
        };
        Insert: Partial<Database["public"]["Tables"]["vehicle_images"]["Row"]> & {
          vehicle_id: string;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["vehicle_images"]["Row"]>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          company_or_name: string;
          city: string | null;
          phone_whatsapp: string | null;
          telegram_handle: string | null;
          instagram_handle: string | null;
          business_type: string | null;
          desired_vehicle_type: string | null;
          budget_min: number | null;
          budget_max: number | null;
          budget_currency: string;
          source: LeadSource | null;
          seriousness_score: number;
          status: LeadStatus;
          last_contact_date: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["leads"]["Row"]> & {
          company_or_name: string;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Row"]>;
        Relationships: [];
      };
      lead_activity_log: {
        Row: {
          id: string;
          lead_id: string;
          activity_type: string | null;
          detail: string | null;
          performed_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["lead_activity_log"]["Row"]> & {
          lead_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["lead_activity_log"]["Row"]>;
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          lead_id: string;
          vehicle_id: string;
          match_score: number | null;
          match_reasoning: Json | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["matches"]["Row"]> & {
          lead_id: string;
          vehicle_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["matches"]["Row"]>;
        Relationships: [];
      };
      offers: {
        Row: {
          id: string;
          lead_id: string | null;
          vehicle_id: string | null;
          base_vehicle_price: number | null;
          export_company_fee: number;
          transport_cost: number;
          insurance_cost: number;
          iran_customs_estimate: number;
          internal_service_fee: number;
          commission_type: CommissionType;
          commission_value: number;
          commission_amount_calculated: number | null;
          final_customer_price: number | null;
          currency: string;
          validity_date: string | null;
          delivery_terms: string | null;
          payment_steps: string | null;
          status: OfferStatus;
          pdf_storage_path: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["offers"]["Row"]> & {
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["offers"]["Row"]>;
        Relationships: [];
      };
      compliance_checklist: {
        Row: {
          id: string;
          offer_id: string;
          export_legality_checked: boolean;
          sanctioned_entity_check_done: boolean;
          vehicle_category_allowed: boolean;
          documents_checked: boolean;
          customs_partner_confirmed: boolean;
          payment_method_agreed: boolean;
          buyer_identity_verified: boolean;
          reviewed_by: string | null;
          reviewed_at: string | null;
          all_clear: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["compliance_checklist"]["Row"]> & {
          offer_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["compliance_checklist"]["Row"]>;
        Relationships: [];
      };
      message_drafts: {
        Row: {
          id: string;
          lead_id: string;
          offer_id: string | null;
          channel: MessageChannel | null;
          draft_text: string | null;
          status: MessageStatus;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["message_drafts"]["Row"]> & {
          lead_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["message_drafts"]["Row"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string | null;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_log"]["Row"]> & {
          actor_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Row"]>;
        Relationships: [];
      };
      market_sources: {
        Row: {
          id: string;
          key: string;
          name: string;
          base_url: string | null;
          enabled: boolean;
          min_interval_minutes: number;
          jitter_percent: number;
          last_run_at: string | null;
          next_run_at: string | null;
          last_status: MarketSourceStatus;
          last_error: string | null;
          method: MarketSourceMethod;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["market_sources"]["Row"]> & {
          key: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["market_sources"]["Row"]>;
        Relationships: [];
      };
      watchlists: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          active: boolean;
          source_keys: string[];
          country: string | null;
          city: string | null;
          brand: string | null;
          model: string | null;
          vehicle_type: VehicleType | null;
          min_year: number | null;
          max_year: number | null;
          max_mileage_km: number | null;
          min_price: number | null;
          max_price: number | null;
          currency: string;
          keywords: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["watchlists"]["Row"]> & {
          user_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["watchlists"]["Row"]>;
        Relationships: [];
      };
      market_listings: {
        Row: {
          id: string;
          source_key: string;
          source_listing_id: string;
          listing_url: string;
          title: string | null;
          seller_name: string | null;
          seller_country: string | null;
          seller_city: string | null;
          brand: string | null;
          model: string | null;
          year: number | null;
          mileage_km: number | null;
          price: number | null;
          currency: string;
          vehicle_type: VehicleType | null;
          raw: Json | null;
          first_seen_at: string;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["market_listings"]["Row"]> & {
          source_key: string;
          source_listing_id: string;
          listing_url: string;
        };
        Update: Partial<Database["public"]["Tables"]["market_listings"]["Row"]>;
        Relationships: [];
      };
      listing_alerts: {
        Row: {
          id: string;
          listing_id: string;
          watchlist_id: string;
          user_id: string;
          status: ListingAlertStatus;
          channel: "telegram";
          error: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["listing_alerts"]["Row"]> & {
          listing_id: string;
          watchlist_id: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["listing_alerts"]["Row"]>;
        Relationships: [];
      };
      scanner_runs: {
        Row: {
          id: string;
          source_key: string;
          started_at: string;
          finished_at: string | null;
          status: ScannerRunStatus;
          fetched_count: number;
          new_count: number;
          alert_count: number;
          next_run_at: string | null;
          error: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["scanner_runs"]["Row"]> & {
          source_key: string;
          status: ScannerRunStatus;
        };
        Update: Partial<Database["public"]["Tables"]["scanner_runs"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
