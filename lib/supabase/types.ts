export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UserRole = "owner" | "broker" | "assistant";
export type VatStatus = "vat_included" | "vat_free" | "margin_scheme" | "unknown";
export type VehicleType = "car" | "van" | "truck" | "trailer" | "construction" | "spare_part" | "bus" | "other";
export type VehicleCondition = "new" | "used_excellent" | "used_good" | "used_fair" | "damaged";
export type FuelType = "gasoline" | "diesel" | "electric" | "hybrid" | "lpg" | "hydrogen" | "other";
export type TransmissionType = "automatic" | "manual" | "semi_automatic" | "other";
export type SellerType = "private" | "dealer" | "unknown";
export type DriveType = "fwd" | "rwd" | "awd" | "other";
export type BodyType = "sedan" | "suv" | "station_wagon" | "hatchback" | "coupe" | "convertible" | "pickup" | "van" | "tractor_unit" | "rigid_truck" | "other";
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
export type ClosedOutcome = "won" | "lost";
export type MessageChannel = "whatsapp" | "telegram" | "instagram";
export type MessageStatus = "draft" | "approved" | "sent" | "discarded";
export type MarketSourceStatus = "idle" | "ok" | "failed" | "blocked" | "skipped";
export type MarketSourceMethod = "scrape" | "email_alert" | "web_search" | "api";
export type MarketSourceVehicleCategory = "car_light_commercial" | "heavy_commercial" | "construction_agri" | "general";
export type ListingAlertStatus = "pending" | "sent" | "failed" | "skipped";
export type ListingAlertType = "new_match" | "price_drop";
export type MarketListingStatus = "active" | "delisted";
export type ListingDecisionStatus = "new" | "shortlisted" | "rejected" | "actioned";
export type ListingDecisionReason =
  | "good_price"
  | "right_vehicle"
  | "trusted_seller"
  | "too_expensive"
  | "wrong_vehicle"
  | "bad_condition"
  | "sold"
  | "duplicate"
  | "other";
export type ScannerRunStatus = "ok" | "failed" | "blocked" | "skipped";
export type MarketSourceCatalogStatus = "planned" | "available" | "degraded" | "blocked" | "retired";
export type ConnectorContractStatus = "unknown" | "ok" | "failed";
export type ScannerIngestChannel = "connector" | "email_alert" | "authorized_automation" | "replay";
export type ScannerIngestEventStatus = "received" | "processing" | "completed" | "rejected" | "failed";
export type OrganizationStatus = "active" | "suspended" | "closed";
export type OrganizationMemberStatus = "invited" | "active" | "suspended";
export type OperationJobStatus = "queued" | "leased" | "running" | "retry_wait" | "succeeded" | "failed" | "dead_letter" | "cancelled";
export type OperationAttemptStatus = "leased" | "running" | "succeeded" | "failed" | "lease_expired";
export type OperationEventLevel = "debug" | "info" | "warn" | "error";
export type OperationAlertType = "slo_breach" | "budget_soft" | "budget_hard" | "rate_limit" | "dead_letter" | "recovery_drill";
export type OperationAlertSeverity = "info" | "warning" | "critical";
export type OperationAlertStatus = "open" | "acknowledged" | "resolved";
export type ProviderObservationOutcome = "success" | "failure" | "timeout" | "rejected";
export type RecoveryDrillType = "backup_restore" | "provider_outage" | "queue_recovery" | "credential_rotation" | "data_retention";
export type RecoveryDrillStatus = "planned" | "running" | "passed" | "failed" | "cancelled";
export type SiteSearchAgentStatus = "pending_activation" | "active" | "paused" | "blocked" | "retired";
export type SiteSearchRunStatus = "running" | "ok" | "partial" | "failed" | "blocked" | "skipped";
export type SearchMode = "strict" | "discovery";
export type SearchSort = "relevance" | "newest" | "price" | "mileage" | "year";
export type SortDirection = "asc" | "desc";
export type RegionPreset = "eu" | "eea" | "schengen" | "balkans";

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
          active_organization_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: UserRole;
          telegram_username?: string | null;
          telegram_chat_id?: string | null;
          telegram_verified_at?: string | null;
          active_organization_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users_profile"]["Insert"]>;
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          organization_id: string;
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
          organization_id: string;
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
          organization_id: string;
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
          organization_id: string;
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
          organization_id: string;
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
          organization_id: string;
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
          export_scenario_result_id?: string | null;
          actual_total_cost: number | null;
          actual_revenue: number | null;
          closed_outcome: ClosedOutcome | null;
          closed_notes: string | null;
          closed_at: string | null;
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
          organization_id: string;
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
          organization_id: string;
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
          organization_id: string;
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
      organizations: {
        Row: { id: string; slug: string; name: string; status: OrganizationStatus; default_currency: string; default_retention_days: number; created_by: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["organizations"]["Row"]> & { slug: string; name: string };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
        Relationships: [];
      };
      organization_members: {
        Row: { organization_id: string; user_id: string; role: UserRole; status: OrganizationMemberStatus; invited_by: string | null; joined_at: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["organization_members"]["Row"]> & { organization_id: string; user_id: string; role: UserRole };
        Update: Partial<Database["public"]["Tables"]["organization_members"]["Row"]>;
        Relationships: [];
      };
      platform_admins: {
        Row: { user_id: string; granted_by: string | null; reason: string; created_at: string };
        Insert: { user_id: string; granted_by?: string | null; reason: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["platform_admins"]["Insert"]>;
        Relationships: [];
      };
      provider_storage_rights_evidence: {
        Row: { id: string; provider_key: string; contract_reference: string; evidence_sha256: string; permitted_data_classes: string[]; permitted_territories: string[]; retention_days: number; effective_at: string; expires_at: string; approved_by: string; approved_at: string; revoked_at: string | null; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["provider_storage_rights_evidence"]["Row"]> & { provider_key: string; contract_reference: string; evidence_sha256: string; permitted_data_classes: string[]; permitted_territories: string[]; retention_days: number; effective_at: string; expires_at: string; approved_by: string };
        Update: Partial<Database["public"]["Tables"]["provider_storage_rights_evidence"]["Row"]>;
        Relationships: [];
      };
      site_search_agents: {
        Row: { id: string; source_key: string; host: string; provider_key: "brave_web"; acquisition_mode: "web_index"; egress_policy: "provider_managed"; processing_mode: "transient_search" | "persistent_search"; status: SiteSearchAgentStatus; interval_minutes: number; jitter_percent: number; max_queries_per_run: number; max_pages_per_query: number; daily_query_limit: number; daily_request_count: number; daily_budget_date: string; reserved_request_count: number; query_cursor: number; next_run_at: string; locked_until: string | null; locked_by: string | null; lease_token: string | null; last_started_at: string | null; last_completed_at: string | null; last_success_at: string | null; last_status: Exclude<SiteSearchRunStatus, "running"> | null; last_error_code: string | null; last_error_message: string | null; consecutive_failures: number; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["site_search_agents"]["Row"]> & { source_key: string; host: string };
        Update: Partial<Database["public"]["Tables"]["site_search_agents"]["Row"]>;
        Relationships: [];
      };
      site_search_agent_runs: {
        Row: { id: string; agent_id: string; source_key: string; correlation_id: string; worker_id: string; lease_token: string; status: SiteSearchRunStatus; reserved_request_count: number; request_count: number; query_count: number; page_count: number; fetched_count: number; inserted_count: number; alerts_created: number; cursor_before: number; cursor_after: number; error_code: string | null; error_message: string | null; started_at: string; completed_at: string | null; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["site_search_agent_runs"]["Row"]> & { agent_id: string; source_key: string; status: SiteSearchRunStatus };
        Update: Partial<Database["public"]["Tables"]["site_search_agent_runs"]["Row"]>;
        Relationships: [];
      };
      operation_jobs: {
        Row: { id: string; organization_id: string; queue: string; job_type: string; job_version: number; idempotency_key: string; payload_hash: string; payload: Json; status: OperationJobStatus; priority: number; attempt_count: number; max_attempts: number; retry_base_seconds: number; retry_cap_seconds: number; replay_count: number; available_at: string; lease_owner: string | null; lease_token: string | null; lease_expires_at: string | null; correlation_id: string; parent_job_id: string | null; result: Json | null; error_code: string | null; error_message: string | null; created_by: string | null; started_at: string | null; completed_at: string | null; retention_until: string; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["operation_jobs"]["Row"]> & { organization_id: string; queue: string; job_type: string; idempotency_key: string; payload_hash: string };
        Update: Partial<Database["public"]["Tables"]["operation_jobs"]["Row"]>;
        Relationships: [];
      };
      operation_attempts: {
        Row: { id: string; organization_id: string; job_id: string; attempt_number: number; worker_id: string; lease_token: string; status: OperationAttemptStatus; started_at: string; finished_at: string | null; duration_ms: number | null; error_code: string | null; error_message: string | null; metrics: Json };
        Insert: Partial<Database["public"]["Tables"]["operation_attempts"]["Row"]> & { organization_id: string; job_id: string; attempt_number: number; worker_id: string; lease_token: string; status: OperationAttemptStatus };
        Update: Partial<Database["public"]["Tables"]["operation_attempts"]["Row"]>;
        Relationships: [];
      };
      operation_events: {
        Row: { id: number; organization_id: string; job_id: string | null; correlation_id: string; level: OperationEventLevel; event_type: string; message: string; attributes: Json; occurred_at: string; retention_until: string };
        Insert: Partial<Database["public"]["Tables"]["operation_events"]["Row"]> & { organization_id: string; correlation_id: string; level: OperationEventLevel; event_type: string; message: string };
        Update: Partial<Database["public"]["Tables"]["operation_events"]["Row"]>;
        Relationships: [];
      };
      operation_alerts: {
        Row: { id: string; organization_id: string; dedupe_key: string; alert_type: OperationAlertType; severity: OperationAlertSeverity; status: OperationAlertStatus; title: string; details: Json; occurrence_count: number; first_occurred_at: string; last_occurred_at: string; acknowledged_by: string | null; acknowledged_at: string | null; resolved_at: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["operation_alerts"]["Row"]> & { organization_id: string; dedupe_key: string; alert_type: OperationAlertType; severity: OperationAlertSeverity; title: string };
        Update: Partial<Database["public"]["Tables"]["operation_alerts"]["Row"]>;
        Relationships: [];
      };
      provider_slo_policies: {
        Row: { id: string; organization_id: string; provider_key: string; operation_type: string; target_availability_percent: number; max_error_rate_percent: number; max_p95_latency_ms: number; window_minutes: number; minimum_samples: number; enabled: boolean; created_by: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["provider_slo_policies"]["Row"]> & { organization_id: string; provider_key: string; operation_type: string; target_availability_percent: number; max_error_rate_percent: number; max_p95_latency_ms: number };
        Update: Partial<Database["public"]["Tables"]["provider_slo_policies"]["Row"]>;
        Relationships: [];
      };
      provider_observations: {
        Row: { id: number; organization_id: string; provider_key: string; operation_type: string; outcome: ProviderObservationOutcome; duration_ms: number; correlation_id: string; job_id: string | null; error_code: string | null; cost_amount: number | null; cost_currency: string | null; metadata: Json; occurred_at: string; retention_until: string };
        Insert: Partial<Database["public"]["Tables"]["provider_observations"]["Row"]> & { organization_id: string; provider_key: string; operation_type: string; outcome: ProviderObservationOutcome; duration_ms: number; correlation_id: string };
        Update: Partial<Database["public"]["Tables"]["provider_observations"]["Row"]>;
        Relationships: [];
      };
      usage_budget_policies: {
        Row: { id: string; organization_id: string; budget_key: string; period: "daily" | "monthly"; unit: string; soft_limit: number; hard_limit: number; enforcement: "warn" | "block"; enabled: boolean; created_by: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["usage_budget_policies"]["Row"]> & { organization_id: string; budget_key: string; period: "daily" | "monthly"; unit: string; soft_limit: number; hard_limit: number };
        Update: Partial<Database["public"]["Tables"]["usage_budget_policies"]["Row"]>;
        Relationships: [];
      };
      usage_ledger: {
        Row: { id: number; organization_id: string; budget_key: string; amount: number; unit: string; cost_amount: number | null; cost_currency: string | null; correlation_id: string; job_id: string | null; metadata: Json; occurred_at: string; retention_until: string };
        Insert: Partial<Database["public"]["Tables"]["usage_ledger"]["Row"]> & { organization_id: string; budget_key: string; amount: number; unit: string; correlation_id: string };
        Update: Partial<Database["public"]["Tables"]["usage_ledger"]["Row"]>;
        Relationships: [];
      };
      rate_limit_policies: {
        Row: { id: string; organization_id: string; limit_key: string; window_seconds: number; max_requests: number; enabled: boolean; created_by: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["rate_limit_policies"]["Row"]> & { organization_id: string; limit_key: string; window_seconds: number; max_requests: number };
        Update: Partial<Database["public"]["Tables"]["rate_limit_policies"]["Row"]>;
        Relationships: [];
      };
      rate_limit_counters: {
        Row: { organization_id: string; limit_key: string; subject_key: string; window_started_at: string; request_count: number; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["rate_limit_counters"]["Row"]> & { organization_id: string; limit_key: string; subject_key: string; window_started_at: string };
        Update: Partial<Database["public"]["Tables"]["rate_limit_counters"]["Row"]>;
        Relationships: [];
      };
      recovery_drills: {
        Row: { id: string; organization_id: string; drill_type: RecoveryDrillType; status: RecoveryDrillStatus; scope: string; evidence: Json; planned_for: string | null; started_at: string | null; completed_at: string | null; created_by: string; reviewed_by: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["recovery_drills"]["Row"]> & { organization_id: string; drill_type: RecoveryDrillType; scope: string; created_by: string };
        Update: Partial<Database["public"]["Tables"]["recovery_drills"]["Row"]>;
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
          locked_until: string | null;
          locked_by: string | null;
          consecutive_failures: number;
          last_success_at: string | null;
          country_codes?: string[];
          vehicle_types?: string[];
          acquisition_modes?: string[];
          connector_version?: string | null;
          connector_capabilities?: Json;
          catalog_status?: MarketSourceCatalogStatus;
          contract_status?: ConnectorContractStatus;
          contract_error?: string | null;
          last_contract_check_at?: string | null;
          data_retention_days?: number;
          terms_url?: string | null;
          robots_url?: string | null;
          vehicle_category?: MarketSourceVehicleCategory;
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
          organization_id: string;
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
          target_price: number | null;
          must_have_keywords: string[];
          excluded_keywords: string[];
          country_codes?: string[];
          region_preset?: RegionPreset | null;
          center_latitude?: number | null;
          center_longitude?: number | null;
          radius_km?: number | null;
          search_mode?: SearchMode;
          freshness_hours?: number;
          sort_by?: SearchSort;
          sort_direction?: SortDirection;
          page_size?: number;
          natural_language_query?: string | null;
          search_plan?: Json;
          search_plan_version?: number;
          search_plan_confirmed_at?: string | null;
          seat_count?: number | null;
          condition?: VehicleCondition | null;
          fuel_type?: FuelType | null;
          transmission?: Exclude<TransmissionType, "other"> | null;
          body_type?: Exclude<BodyType, "tractor_unit" | "rigid_truck" | "other"> | null;
          drive_type?: Exclude<DriveType, "other"> | null;
          seller_type?: Exclude<SellerType, "unknown"> | null;
          min_power_hp?: number | null;
          max_power_hp?: number | null;
          min_engine_cc?: number | null;
          max_engine_cc?: number | null;
          min_doors?: number | null;
          max_doors?: number | null;
          emission_class?: string | null;
          exterior_color?: string | null;
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
          description?: string | null;
          seller_country_code?: string | null;
          seller_postal_code?: string | null;
          seller_type?: SellerType | null;
          latitude?: number | null;
          longitude?: number | null;
          variant?: string | null;
          first_registration_date?: string | null;
          vat_deductible?: boolean | null;
          body_type?: BodyType | null;
          fuel_type?: FuelType | null;
          transmission?: TransmissionType | null;
          drive_type?: DriveType | null;
          power_hp?: number | null;
          engine_cc?: number | null;
          emission_class?: string | null;
          exterior_color?: string | null;
          vin?: string | null;
          seat_count?: number | null;
          door_count?: number | null;
          condition?: VehicleCondition | null;
          image_urls?: string[];
          published_at?: string | null;
          canonical_schema_version?: number | null;
          normalization_confidence?: number | null;
          normalization_warnings?: string[];
          canonical_fingerprint?: string | null;
          normalized_at?: string | null;
          normalization_evidence?: Json;
          duplicate_cluster_id?: string | null;
          raw: Json | null;
          status: MarketListingStatus;
          delisted_at: string | null;
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
      market_listing_price_history: {
        Row: {
          id: string;
          listing_id: string;
          price: number | null;
          currency: string | null;
          recorded_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["market_listing_price_history"]["Row"]> & {
          listing_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["market_listing_price_history"]["Row"]>;
        Relationships: [];
      };
      export_routes: {
        Row: { id: string; code: string; name: string; origin_country_code: string; destination_country_code: string; transit_country_codes: string[]; transport_mode: "road" | "rail" | "sea" | "air" | "multimodal"; default_currency: string; assumptions: Json; active: boolean; created_by: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["export_routes"]["Row"]> & { code: string; name: string; origin_country_code: string; destination_country_code: string; transport_mode: "road" | "rail" | "sea" | "air" | "multimodal" };
        Update: Partial<Database["public"]["Tables"]["export_routes"]["Row"]>;
        Relationships: [];
      };
      export_rule_sets: {
        Row: { id: string; code: string; name: string; version: number; status: "draft" | "active" | "retired"; origin_country_code: string | null; destination_country_code: string | null; vehicle_category: string | null; buyer_profile: string | null; effective_from: string | null; effective_to: string | null; source_references: Json; assumptions: Json; required_documents: Json; created_by: string | null; approved_by: string | null; approved_at: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["export_rule_sets"]["Row"]> & { code: string; name: string; version: number };
        Update: Partial<Database["public"]["Tables"]["export_rule_sets"]["Row"]>;
        Relationships: [];
      };
      export_rules: {
        Row: { id: string; rule_set_id: string; rule_code: string; label: string; category: "tax" | "customs" | "logistics" | "insurance" | "service" | "compliance" | "other"; calculation_type: "fixed" | "percentage"; base_key: "vehicle_price" | "customs_value" | "subtotal" | null; amount: number | null; rate_percent: number | null; currency: string | null; minimum_amount: number | null; maximum_amount: number | null; conditions: Json; blocking: boolean; evidence_required: boolean; sort_order: number; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["export_rules"]["Row"]> & { rule_set_id: string; rule_code: string; label: string; category: "tax" | "customs" | "logistics" | "insurance" | "service" | "compliance" | "other"; calculation_type: "fixed" | "percentage" };
        Update: Partial<Database["public"]["Tables"]["export_rules"]["Row"]>;
        Relationships: [];
      };
      exchange_rate_snapshots: {
        Row: { id: string; base_currency: string; quote_currency: string; rate: number; provider: string; source_reference: string | null; observed_at: string; expires_at: string | null; created_by: string | null; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["exchange_rate_snapshots"]["Row"]> & { base_currency: string; quote_currency: string; rate: number; provider: string; observed_at: string };
        Update: Partial<Database["public"]["Tables"]["exchange_rate_snapshots"]["Row"]>;
        Relationships: [];
      };
      export_scenarios: {
        Row: { id: string; organization_id: string; name: string; vehicle_id: string | null; market_listing_id: string | null; offer_id: string | null; route_id: string | null; rule_set_id: string | null; origin_country_code: string; destination_country_code: string; transport_mode: "road" | "rail" | "sea" | "air" | "multimodal"; vehicle_category: string; buyer_profile: string; calculation_currency: string; vehicle_price: number; vehicle_currency: string; manual_costs: Json; assumptions: Json; status: "draft" | "calculated" | "approved" | "archived"; approval_status: "pending" | "approved" | "rejected" | "needs_review"; approval_reason: string | null; approved_by: string | null; approved_at: string | null; created_by: string; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["export_scenarios"]["Row"]> & { name: string; origin_country_code: string; destination_country_code: string; transport_mode: "road" | "rail" | "sea" | "air" | "multimodal"; vehicle_category: string; buyer_profile: string; vehicle_price: number; vehicle_currency: string; created_by: string };
        Update: Partial<Database["public"]["Tables"]["export_scenarios"]["Row"]>;
        Relationships: [];
      };
      export_scenario_results: {
        Row: { id: string; organization_id: string; scenario_id: string; calculation_version: string; evidence_hash: string; input_snapshot: Json; rule_snapshot: Json; exchange_rate_snapshot: Json; cost_lines: Json; totals: Json; sensitivity: Json; compliance: Json; calculated_by: string | null; calculated_at: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["export_scenario_results"]["Row"]> & { scenario_id: string; calculation_version: string; evidence_hash: string; input_snapshot: Json; rule_snapshot: Json; exchange_rate_snapshot: Json; cost_lines: Json; totals: Json; sensitivity: Json; compliance: Json };
        Update: Partial<Database["public"]["Tables"]["export_scenario_results"]["Row"]>;
        Relationships: [];
      };
      export_scenario_documents: {
        Row: { id: string; organization_id: string; scenario_id: string; document_code: string; label: string; required: boolean; status: "pending" | "received" | "verified" | "rejected" | "not_applicable"; notes: string | null; evidence_reference: string | null; evidence_sha256: string | null; document_issued_at: string | null; valid_until: string | null; reviewed_by: string | null; reviewed_at: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["export_scenario_documents"]["Row"]> & { scenario_id: string; document_code: string; label: string };
        Update: Partial<Database["public"]["Tables"]["export_scenario_documents"]["Row"]>;
        Relationships: [];
      };
      market_intelligence_snapshots: {
        Row: {
          id: string;
          listing_id: string;
          analysis_version: string;
          evidence_hash: string;
          sample_quality: "insufficient" | "low" | "medium" | "high";
          claim_eligible: boolean;
          comparable_count: number;
          source_count: number;
          comparable_listing_ids: string[];
          distribution: Json;
          underpricing_percent: number | null;
          confidence: number;
          risk_score: number;
          risk_level: "unknown" | "low" | "medium" | "high" | "critical";
          risk_signals: Json;
          seller_signals: Json;
          price_trend: Json;
          evidence: Json;
          calculated_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["market_intelligence_snapshots"]["Row"]> & { listing_id: string; analysis_version: string; evidence_hash: string; sample_quality: "insufficient" | "low" | "medium" | "high" };
        Update: Partial<Database["public"]["Tables"]["market_intelligence_snapshots"]["Row"]>;
        Relationships: [];
      };
      listing_media_rights: {
        Row: {
          id: string;
          listing_id: string;
          image_url: string;
          rights_status: "unknown" | "source_permitted" | "partner_authorized" | "user_authorized" | "prohibited";
          analysis_allowed: boolean;
          rights_source: string | null;
          checked_by: string | null;
          checked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["listing_media_rights"]["Row"]> & { listing_id: string; image_url: string };
        Update: Partial<Database["public"]["Tables"]["listing_media_rights"]["Row"]>;
        Relationships: [];
      };
      ai_evaluations: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          listing_id: string;
          intelligence_snapshot_id: string | null;
          evaluation_type: "market_review" | "damage_review" | "listing_summary";
          status: "pending" | "completed" | "failed" | "skipped";
          provider: string;
          model: string | null;
          prompt_version: string;
          input_evidence: Json;
          output: Json | null;
          confidence: number | null;
          input_tokens: number;
          output_tokens: number;
          cost_usd: number;
          provider_response_id: string | null;
          error: string | null;
          human_decision: "pending" | "accepted" | "rejected" | "needs_review";
          human_decision_reason: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_evaluations"]["Row"]> & { listing_id: string; evaluation_type: "market_review" | "damage_review" | "listing_summary"; prompt_version: string };
        Update: Partial<Database["public"]["Tables"]["ai_evaluations"]["Row"]>;
        Relationships: [];
      };
      listing_duplicate_clusters: {
        Row: {
          id: string;
          cluster_key: string;
          match_strategy: string;
          confidence: number;
          primary_listing_id: string | null;
          member_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["listing_duplicate_clusters"]["Row"]> & {
          cluster_key: string;
        };
        Update: Partial<Database["public"]["Tables"]["listing_duplicate_clusters"]["Row"]>;
        Relationships: [];
      };
      listing_alerts: {
        Row: {
          id: string;
          organization_id: string;
          listing_id: string;
          watchlist_id: string;
          user_id: string;
          status: ListingAlertStatus;
          alert_type: ListingAlertType;
          channel: "telegram";
          error: string | null;
          opportunity_score: number | null;
          opportunity_label: "hot" | "good" | "watch" | "low" | null;
          opportunity_reasons: Json | null;
          decision_status: ListingDecisionStatus;
          decision_reason: ListingDecisionReason | null;
          decided_at: string | null;
          sent_at: string | null;
          delivery_attempts: number;
          next_attempt_at: string | null;
          digest_claim_token: string | null;
          digest_claimed_until: string | null;
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
      scanner_ingest_events: {
        Row: {
          id: string;
          organization_id: string;
          source_key: string;
          channel: ScannerIngestChannel;
          idempotency_key: string;
          payload_hash: string;
          payload: Json | null;
          status: ScannerIngestEventStatus;
          listing_count: number;
          result: Json | null;
          attempt_count: number;
          error_code: string | null;
          error_message: string | null;
          next_retry_at: string | null;
          processing_started_at: string | null;
          completed_at: string | null;
          payload_expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["scanner_ingest_events"]["Row"]> & {
          source_key: string;
          channel: ScannerIngestChannel;
          idempotency_key: string;
          payload_hash: string;
        };
        Update: Partial<Database["public"]["Tables"]["scanner_ingest_events"]["Row"]>;
        Relationships: [];
      };
      listing_purchase_checklist: {
        Row: {
          id: string;
          organization_id: string;
          listing_id: string;
          vin: string | null;
          vin_verified: boolean;
          documents_checked: boolean;
          damage_inspected: boolean;
          damage_notes: string | null;
          seller_trustworthy: boolean;
          seller_notes: string | null;
          payment_risk_acceptable: boolean;
          payment_notes: string | null;
          estimated_transport_cost: number;
          estimated_insurance_cost: number;
          estimated_customs_cost: number;
          estimated_prep_cost: number;
          all_clear: boolean;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["listing_purchase_checklist"]["Row"]> & {
          listing_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["listing_purchase_checklist"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
      Functions: {
      claim_due_market_sources: {
        Args: {
          p_force?: boolean;
          p_source_key?: string | null;
          p_worker_id?: string | null;
          p_lease_minutes?: number;
        };
        Returns: Database["public"]["Tables"]["market_sources"]["Row"][];
      };
      purge_expired_scanner_ingest_payloads: {
        Args: Record<string, never>;
        Returns: number;
      };
      is_organization_member: { Args: { p_organization_id: string; p_roles?: string[] | null }; Returns: boolean };
      current_organization_id: { Args: Record<string, never>; Returns: string | null };
      set_active_organization: { Args: { p_organization_id: string }; Returns: string };
      is_platform_admin: { Args: Record<string, never>; Returns: boolean };
      activate_site_search_agent_fleet: { Args: Record<string, never>; Returns: number };
      activate_transient_site_search_agent_fleet: { Args: Record<string, never>; Returns: number };
      reconcile_site_search_agent_fleet: { Args: Record<string, never>; Returns: number };
      claim_due_site_search_agents: { Args: { p_worker_id: string; p_limit?: number; p_lease_seconds?: number; p_source_key?: string | null; p_force?: boolean }; Returns: Database["public"]["Tables"]["site_search_agents"]["Row"][] };
      start_site_search_agent_run: { Args: { p_agent_id: string; p_worker_id: string; p_lease_token: string; p_correlation_id: string }; Returns: string };
      finish_site_search_agent_run: { Args: { p_run_id: string; p_agent_id: string; p_worker_id: string; p_lease_token: string; p_status: Exclude<SiteSearchRunStatus, "running">; p_request_count: number; p_query_count: number; p_page_count: number; p_fetched_count: number; p_inserted_count: number; p_alerts_created: number; p_cursor_after: number; p_next_run_at: string; p_error_code?: string | null; p_error_message?: string | null; p_block_agent?: boolean }; Returns: boolean };
      claim_opportunity_digest_alerts: { Args: { p_claim_token: string; p_limit?: number; p_user_id?: string | null; p_lease_seconds?: number }; Returns: Database["public"]["Tables"]["listing_alerts"]["Row"][] };
      finish_opportunity_digest_alerts: { Args: { p_claim_token: string; p_alert_ids: string[]; p_sent: boolean; p_error?: string | null }; Returns: number };
      mark_opportunity_digest_uncertain: { Args: { p_claim_token: string; p_alert_ids: string[]; p_error?: string | null }; Returns: number };
      set_organization_member_role: { Args: { p_organization_id: string; p_target_user_id: string; p_new_role: UserRole }; Returns: Database["public"]["Tables"]["organization_members"]["Row"] };
      claim_operation_jobs: { Args: { p_worker_id: string; p_queues: string[]; p_limit?: number; p_lease_seconds?: number }; Returns: Database["public"]["Tables"]["operation_jobs"]["Row"][] };
      recover_expired_operation_leases: { Args: Record<string, never>; Returns: number };
      heartbeat_operation_job: { Args: { p_job_id: string; p_lease_token: string; p_extend_seconds?: number }; Returns: boolean };
      complete_operation_job: { Args: { p_job_id: string; p_lease_token: string; p_result?: Json; p_metrics?: Json }; Returns: Database["public"]["Tables"]["operation_jobs"]["Row"] };
      fail_operation_job: { Args: { p_job_id: string; p_lease_token: string; p_error_code: string; p_error_message: string; p_retryable?: boolean; p_metrics?: Json }; Returns: Database["public"]["Tables"]["operation_jobs"]["Row"] };
      replay_dead_letter_operation: { Args: { p_job_id: string }; Returns: Database["public"]["Tables"]["operation_jobs"]["Row"] };
      purge_expired_operation_data: { Args: Record<string, never>; Returns: Json };
      consume_rate_limit: { Args: { p_organization_id: string; p_limit_key: string; p_subject_key: string; p_units?: number }; Returns: Json };
      consume_usage_budget: { Args: { p_organization_id: string; p_budget_key: string; p_amount: number; p_unit: string; p_correlation_id: string; p_job_id?: string | null; p_cost_amount?: number | null; p_cost_currency?: string | null; p_metadata?: Json }; Returns: Json };
      record_provider_observation: { Args: { p_organization_id: string; p_provider_key: string; p_operation_type: string; p_outcome: ProviderObservationOutcome; p_duration_ms: number; p_correlation_id: string; p_job_id?: string | null; p_error_code?: string | null; p_cost_amount?: number | null; p_cost_currency?: string | null; p_metadata?: Json }; Returns: Json };
      acknowledge_operation_alert: { Args: { p_alert_id: string }; Returns: Database["public"]["Tables"]["operation_alerts"]["Row"] };
      start_recovery_drill: { Args: { p_drill_id: string }; Returns: Database["public"]["Tables"]["recovery_drills"]["Row"] };
      complete_recovery_drill: { Args: { p_drill_id: string; p_status: "passed" | "failed"; p_evidence: Json }; Returns: Database["public"]["Tables"]["recovery_drills"]["Row"] };
      run_operational_maintenance: { Args: Record<string, never>; Returns: Json };
      purge_expired_operational_metrics: { Args: Record<string, never>; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
