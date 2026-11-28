export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          metadata: Json
          organization_id: string
          summary: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          metadata?: Json
          organization_id: string
          summary: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          organization_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          business_type: string
          city: string | null
          contact_email: string | null
          contact_phone_e164: string | null
          country_code: string
          created_at: string
          currency: string
          description: string | null
          display_name: string
          legal_name: string | null
          organization_id: string
          postal_code: string | null
          region: string | null
          timezone: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          business_type: string
          city?: string | null
          contact_email?: string | null
          contact_phone_e164?: string | null
          country_code?: string
          created_at?: string
          currency?: string
          description?: string | null
          display_name: string
          legal_name?: string | null
          organization_id: string
          postal_code?: string | null
          region?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          business_type?: string
          city?: string | null
          contact_email?: string | null
          contact_phone_e164?: string | null
          country_code?: string
          created_at?: string
          currency?: string
          description?: string | null
          display_name?: string
          legal_name?: string | null
          organization_id?: string
          postal_code?: string | null
          region?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_capacity_reservations: {
        Row: {
          call_id: string
          created_at: string
          id: string
          lease_expires_at: string
          organization_id: string
          receptionist_instance_id: string | null
          released_at: string | null
          status: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          lease_expires_at: string
          organization_id: string
          receptionist_instance_id?: string | null
          released_at?: string | null
          status?: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          lease_expires_at?: string
          organization_id?: string
          receptionist_instance_id?: string | null
          released_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_capacity_receptionist_fk"
            columns: ["organization_id", "receptionist_instance_id"]
            isOneToOne: false
            referencedRelation: "receptionist_instances"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "call_capacity_reservations_organization_id_call_id_fkey"
            columns: ["organization_id", "call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      calls: {
        Row: {
          answered_at: string | null
          called_e164: string | null
          caller_e164: string | null
          created_at: string
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          guest_name: string | null
          id: string
          organization_id: string
          outcome: string | null
          phone_number_id: string | null
          provider: string
          provider_call_id: string
          receptionist_instance_id: string | null
          started_at: string
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          called_e164?: string | null
          caller_e164?: string | null
          created_at?: string
          direction: string
          duration_seconds?: number | null
          ended_at?: string | null
          guest_name?: string | null
          id?: string
          organization_id: string
          outcome?: string | null
          phone_number_id?: string | null
          provider?: string
          provider_call_id: string
          receptionist_instance_id?: string | null
          started_at: string
          status: string
          summary?: string
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          called_e164?: string | null
          caller_e164?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          guest_name?: string | null
          id?: string
          organization_id?: string
          outcome?: string | null
          phone_number_id?: string | null
          provider?: string
          provider_call_id?: string
          receptionist_instance_id?: string | null
          started_at?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_organization_phone_fk"
            columns: ["organization_id", "phone_number_id"]
            isOneToOne: false
            referencedRelation: "organization_phone_numbers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "calls_organization_receptionist_fk"
            columns: ["organization_id", "receptionist_instance_id"]
            isOneToOne: false
            referencedRelation: "receptionist_instances"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      guests: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          last_seen_at: string | null
          notes: string
          organization_id: string
          phone_e164: string | null
          source: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          last_seen_at?: string | null
          notes?: string
          organization_id: string
          phone_e164?: string | null
          source?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          last_seen_at?: string | null
          notes?: string
          organization_id?: string
          phone_e164?: string | null
          source?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_member_role"]
          status: Database["public"]["Enums"]["organization_membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_member_role"]
          status?: Database["public"]["Enums"]["organization_membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          status?: Database["public"]["Enums"]["organization_membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_modules: {
        Row: {
          created_at: string
          disabled_at: string | null
          enabled_at: string
          is_enabled: boolean
          module_key: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          disabled_at?: string | null
          enabled_at?: string
          is_enabled?: boolean
          module_key: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          disabled_at?: string | null
          enabled_at?: string
          is_enabled?: boolean
          module_key?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country_code: string
          created_at: string
          created_by: string | null
          currency_override: string | null
          description: string
          id: string
          name: string
          organization_id: string
          postal_code: string | null
          region: string | null
          slug: string
          status: string
          timezone_override: string | null
          updated_at: string
          vertical: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          currency_override?: string | null
          description?: string
          id?: string
          name: string
          organization_id: string
          postal_code?: string | null
          region?: string | null
          slug: string
          status?: string
          timezone_override?: string | null
          updated_at?: string
          vertical: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          currency_override?: string | null
          description?: string
          id?: string
          name?: string
          organization_id?: string
          postal_code?: string | null
          region?: string | null
          slug?: string
          status?: string
          timezone_override?: string | null
          updated_at?: string
          vertical?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_staff_assignments: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          organization_id: string
          property_id: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          organization_id: string
          property_id: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string
          property_id?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_staff_assignments_organization_id_property_id_fkey"
            columns: ["organization_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "property_staff_assignments_organization_id_user_id_fkey"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      room_types: {
        Row: {
          amenities: string[]
          archived_at: string | null
          bed_configuration: Json
          created_at: string
          default_capacity: number
          default_nightly_rate_minor: number | null
          description: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          property_id: string
          updated_at: string
        }
        Insert: {
          amenities?: string[]
          archived_at?: string | null
          bed_configuration?: Json
          created_at?: string
          default_capacity?: number
          default_nightly_rate_minor?: number | null
          description?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          property_id: string
          updated_at?: string
        }
        Update: {
          amenities?: string[]
          archived_at?: string | null
          bed_configuration?: Json
          created_at?: string
          default_capacity?: number
          default_nightly_rate_minor?: number | null
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_types_organization_id_property_id_fkey"
            columns: ["organization_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      organization_phone_numbers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          organization_id: string
          phone_e164: string
          status: string
          updated_at: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          organization_id: string
          phone_e164: string
          status?: string
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          organization_id?: string
          phone_e164?: string
          status?: string
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_phone_numbers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          billing_provider: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          concurrent_call_limit: number | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          ended_at: string | null
          entitlements_configured: boolean
          id: string
          metadata: Json
          organization_id: string
          phone_number_limit: number | null
          plan_id: string
          price_id: string | null
          provider_customer_ref: string | null
          provider_subscription_ref: string | null
          receptionist_instance_limit: number | null
          status: string
          team_member_limit: number | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string
        }
        Insert: {
          billing_provider?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          concurrent_call_limit?: number | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          entitlements_configured?: boolean
          id?: string
          metadata?: Json
          organization_id: string
          phone_number_limit?: number | null
          plan_id: string
          price_id?: string | null
          provider_customer_ref?: string | null
          provider_subscription_ref?: string | null
          receptionist_instance_limit?: number | null
          status?: string
          team_member_limit?: number | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
        Update: {
          billing_provider?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          concurrent_call_limit?: number | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          entitlements_configured?: boolean
          id?: string
          metadata?: Json
          organization_id?: string
          phone_number_limit?: number | null
          plan_id?: string
          price_id?: string | null
          provider_customer_ref?: string | null
          provider_subscription_ref?: string | null
          receptionist_instance_limit?: number | null
          status?: string
          team_member_limit?: number | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "subscription_prices"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Relationships: []
      }
      phone_number_channels: {
        Row: {
          channel: string
          connected_at: string | null
          created_at: string
          id: string
          organization_id: string
          phone_number_id: string
          status: string
          updated_at: string
        }
        Insert: {
          channel: string
          connected_at?: string | null
          created_at?: string
          id?: string
          organization_id: string
          phone_number_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          connected_at?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          phone_number_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_number_channels_organization_id_phone_number_id_fkey"
            columns: ["organization_id", "phone_number_id"]
            isOneToOne: false
            referencedRelation: "organization_phone_numbers"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string | null
          id: string
          phone_e164: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          phone_e164?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone_e164?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      receptionist_instances: {
        Row: {
          configuration: Json
          created_at: string
          created_by: string | null
          description: string
          display_name: string
          greeting: string
          id: string
          language_code: string
          organization_id: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          description?: string
          display_name: string
          greeting?: string
          id?: string
          language_code?: string
          organization_id: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          created_by?: string | null
          description?: string
          display_name?: string
          greeting?: string
          id?: string
          language_code?: string
          organization_id?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receptionist_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      receptionist_number_routes: {
        Row: {
          channel: string
          created_at: string
          id: string
          is_enabled: boolean
          organization_id: string
          phone_number_id: string
          priority: number
          receptionist_instance_id: string
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          organization_id: string
          phone_number_id: string
          priority?: number
          receptionist_instance_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          organization_id?: string
          phone_number_id?: string
          priority?: number
          receptionist_instance_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receptionist_number_routes_organization_id_phone_number_id_fkey"
            columns: ["organization_id", "phone_number_id"]
            isOneToOne: false
            referencedRelation: "organization_phone_numbers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "receptionist_number_routes_organization_id_receptionist_in_fkey"
            columns: ["organization_id", "receptionist_instance_id"]
            isOneToOne: false
            referencedRelation: "receptionist_instances"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "receptionist_routes_require_channel"
            columns: ["organization_id", "phone_number_id", "channel"]
            isOneToOne: false
            referencedRelation: "phone_number_channels"
            referencedColumns: ["organization_id", "phone_number_id", "channel"]
          },
        ]
      }
      reservations: {
        Row: {
          adults: number
          arrival_date: string
          children: number
          confirmation_code: string | null
          created_at: string
          created_by: string | null
          currency: string
          departure_date: string
          guest_id: string | null
          id: string
          organization_id: string
          property_id: string
          room_id: string | null
          source: string
          special_requests: string
          status: string
          total_amount_minor: number | null
          updated_at: string
        }
        Insert: {
          adults?: number
          arrival_date: string
          children?: number
          confirmation_code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          departure_date: string
          guest_id?: string | null
          id?: string
          organization_id: string
          property_id: string
          room_id?: string | null
          source?: string
          special_requests?: string
          status?: string
          total_amount_minor?: number | null
          updated_at?: string
        }
        Update: {
          adults?: number
          arrival_date?: string
          children?: number
          confirmation_code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          departure_date?: string
          guest_id?: string | null
          id?: string
          organization_id?: string
          property_id?: string
          room_id?: string | null
          source?: string
          special_requests?: string
          status?: string
          total_amount_minor?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_organization_guest_fk"
            columns: ["organization_id", "guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_org_property_fk"
            columns: ["organization_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "reservations_org_property_room_fk"
            columns: ["organization_id", "property_id", "room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["organization_id", "property_id", "id"]
          },
          {
            foreignKeyName: "reservations_organization_room_fk"
            columns: ["organization_id", "room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number
          created_at: string
          currency: string
          floor_label: string | null
          id: string
          nightly_rate_minor: number | null
          notes: string
          organization_id: string
          property_id: string
          room_type_id: string
          room_number: string
          room_type: string
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          currency?: string
          floor_label?: string | null
          id?: string
          nightly_rate_minor?: number | null
          notes?: string
          organization_id: string
          property_id: string
          room_type_id: string
          room_number: string
          room_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          currency?: string
          floor_label?: string | null
          id?: string
          nightly_rate_minor?: number | null
          notes?: string
          organization_id?: string
          property_id?: string
          room_type_id?: string
          room_number?: string
          room_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_org_property_fk"
            columns: ["organization_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "rooms_org_property_room_type_fk"
            columns: ["organization_id", "property_id", "room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["organization_id", "property_id", "id"]
          },
        ]
      }
      subscription_plan_entitlements: {
        Row: {
          concurrent_call_limit: number | null
          configuration_status: string
          custom_entitlements: boolean
          phone_number_limit: number | null
          plan_id: string
          receptionist_instance_limit: number | null
          team_member_limit: number | null
          updated_at: string
        }
        Insert: {
          concurrent_call_limit?: number | null
          configuration_status?: string
          custom_entitlements?: boolean
          phone_number_limit?: number | null
          plan_id: string
          receptionist_instance_limit?: number | null
          team_member_limit?: number | null
          updated_at?: string
        }
        Update: {
          concurrent_call_limit?: number | null
          configuration_status?: string
          custom_entitlements?: boolean
          phone_number_limit?: number | null
          plan_id?: string
          receptionist_instance_limit?: number | null
          team_member_limit?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          code: string
          created_at: string
          description: string
          display_order: number
          id: string
          is_available_for_purchase: boolean
          is_listed: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          display_order: number
          id?: string
          is_available_for_purchase?: boolean
          is_listed?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          is_available_for_purchase?: boolean
          is_listed?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_prices: {
        Row: {
          amount_minor: number
          billing_interval: string
          created_at: string
          currency: string
          effective_from: string
          effective_until: string | null
          id: string
          is_active: boolean
          plan_id: string
          provider: string
          provider_price_ref: string | null
        }
        Insert: {
          amount_minor: number
          billing_interval: string
          created_at?: string
          currency?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          plan_id: string
          provider: string
          provider_price_ref?: string | null
        }
        Update: {
          amount_minor?: number
          billing_interval?: string
          created_at?: string
          currency?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_active?: boolean
          plan_id?: string
          provider?: string
          provider_price_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_provider_events: {
        Row: {
          event_type: string
          id: string
          last_error: string | null
          organization_id: string | null
          payload: Json
          processed_at: string | null
          processing_status: string
          provider: string
          provider_event_id: string
          received_at: string
        }
        Insert: {
          event_type: string
          id?: string
          last_error?: string | null
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          provider: string
          provider_event_id: string
          received_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          last_error?: string | null
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          provider?: string
          provider_event_id?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_provider_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization: {
        Args: {
          p_business_type: string
          p_currency?: string
          p_name: string
          p_timezone?: string
        }
        Returns: string
      }
      create_property: {
        Args: {
          p_city?: string
          p_currency_override?: string
          p_description?: string
          p_name: string
          p_organization_id: string
          p_region?: string
          p_slug: string
          p_timezone_override?: string
          p_vertical: string
        }
        Returns: Database["public"]["Tables"]["properties"]["Row"]
      }
      create_receptionist_instance: {
        Args: {
          p_created_by?: string
          p_description?: string
          p_display_name: string
          p_greeting?: string
          p_language_code?: string
          p_organization_id: string
          p_timezone?: string
        }
        Returns: string
      }
      register_verified_phone_number: {
        Args: {
          p_created_by?: string
          p_label?: string
          p_organization_id: string
          p_phone_e164: string
        }
        Returns: string
      }
      release_call_capacity: { Args: { p_call_id: string }; Returns: boolean }
      reserve_call_capacity: {
        Args: {
          p_call_id: string
          p_lease_seconds?: number
          p_organization_id: string
          p_receptionist_instance_id: string
        }
        Returns: string
      }
    }
    Enums: {
      organization_member_role:
        | "owner"
        | "manager"
        | "operations"
        | "verification"
      organization_membership_status: "active" | "invited" | "suspended"
      organization_status: "active" | "suspended" | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      organization_member_role: [
        "owner",
        "manager",
        "operations",
        "verification",
      ],
      organization_membership_status: ["active", "invited", "suspended"],
      organization_status: ["active", "suspended", "archived"],
    },
  },
} as const
