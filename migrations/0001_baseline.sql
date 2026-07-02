SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);

CREATE TABLE public.app_user (
    id character varying NOT NULL,
    email character varying NOT NULL,
    empresa character varying,
    role character varying DEFAULT 'SUPERVISOR'::character varying NOT NULL,
    operacao_id character varying,
    base_scope character varying DEFAULT 'SINGLE'::character varying NOT NULL,
    extra_perms json DEFAULT '[]'::json NOT NULL,
    denied_perms json DEFAULT '[]'::json NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    last_login_at timestamp without time zone,
    active boolean DEFAULT true NOT NULL,
    sidebar_operacoes text[],
    principal_operacao_id character varying,
    approval_status character varying DEFAULT 'approved'::character varying NOT NULL,
    cargo character varying,
    CONSTRAINT app_user_approval_status_check CHECK (((approval_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);

CREATE TABLE public.base (
    id character varying DEFAULT (gen_random_uuid())::text NOT NULL,
    operacao_id character varying NOT NULL,
    slug character varying NOT NULL,
    label character varying NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.cep_cache (
    cep character varying NOT NULL,
    cidade character varying NOT NULL,
    bairro character varying NOT NULL,
    uf character varying,
    fetched_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.driver (
    id character varying NOT NULL,
    operacao_id character varying NOT NULL,
    name character varying NOT NULL,
    normalized_key character varying NOT NULL,
    spx_driver_id character varying,
    documento character varying,
    telefone character varying,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.liberacao (
    id character varying DEFAULT (gen_random_uuid())::text NOT NULL,
    user_id character varying NOT NULL,
    base_id character varying NOT NULL,
    status character varying NOT NULL,
    observacao character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.operacao (
    id character varying DEFAULT (gen_random_uuid())::text NOT NULL,
    slug character varying NOT NULL,
    label character varying NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    in_sidebar boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.package (
    id character varying DEFAULT (gen_random_uuid())::text NOT NULL,
    upload_id character varying NOT NULL,
    base_id character varying NOT NULL,
    driver_id character varying,
    codigo character varying NOT NULL,
    status character varying NOT NULL,
    finalizado_at timestamp without time zone,
    imported_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.shopee_base_cidade (
    id bigint NOT NULL,
    base_id character varying NOT NULL,
    cidade character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    enabled boolean DEFAULT false NOT NULL
);

CREATE SEQUENCE public.shopee_base_cidade_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shopee_base_cidade_id_seq OWNED BY public.shopee_base_cidade.id;

CREATE TABLE public.shopee_ds_checkpoint (
    id bigint NOT NULL,
    base_id character varying NOT NULL,
    data_pt_br character varying NOT NULL,
    seq integer NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    label character varying NOT NULL,
    saiu integer DEFAULT 0 NOT NULL,
    entregues integer DEFAULT 0 NOT NULL,
    em_rota integer DEFAULT 0 NOT NULL,
    ocorrencias integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.shopee_ds_checkpoint_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shopee_ds_checkpoint_id_seq OWNED BY public.shopee_ds_checkpoint.id;

CREATE TABLE public.shopee_ds_driver (
    id bigint NOT NULL,
    base_id character varying NOT NULL,
    data_pt_br character varying NOT NULL,
    driver_id character varying,
    driver_name character varying NOT NULL,
    saiu integer DEFAULT 0 NOT NULL,
    entregues integer DEFAULT 0 NOT NULL,
    em_rota integer DEFAULT 0 NOT NULL,
    ocorrencias integer DEFAULT 0 NOT NULL,
    is_demo boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.shopee_ds_driver_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shopee_ds_driver_id_seq OWNED BY public.shopee_ds_driver.id;

CREATE TABLE public.shopee_package (
    id bigint NOT NULL,
    base_id character varying NOT NULL,
    codigo character varying NOT NULL,
    status character varying NOT NULL,
    driver_id character varying,
    dias_preso numeric(6,2),
    agency character varying,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_status_at timestamp with time zone DEFAULT now() NOT NULL,
    delivered_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_backlog_date date,
    cep character varying
);

CREATE TABLE public.shopee_package_event (
    id bigint NOT NULL,
    package_id bigint NOT NULL,
    status character varying NOT NULL,
    dias_preso numeric(6,2),
    driver_id character varying,
    source_upload_id character varying,
    observed_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.shopee_package_event_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shopee_package_event_id_seq OWNED BY public.shopee_package_event.id;

CREATE SEQUENCE public.shopee_package_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shopee_package_id_seq OWNED BY public.shopee_package.id;

CREATE TABLE public.shopee_pnr (
    spxtn character varying NOT NULL,
    driver_id character varying,
    driver_name character varying DEFAULT ''::character varying NOT NULL,
    base_id character varying,
    station_raw character varying,
    valor numeric(12,2),
    status character varying NOT NULL,
    motivo character varying,
    prazo timestamp with time zone,
    created_time timestamp with time zone,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_status_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.shopee_sla_checkpoint (
    id bigint NOT NULL,
    base_id character varying NOT NULL,
    data_pt_br character varying NOT NULL,
    seq integer NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    label character varying NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    entregues integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.shopee_sla_checkpoint_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shopee_sla_checkpoint_id_seq OWNED BY public.shopee_sla_checkpoint.id;

CREATE TABLE public.shopee_sla_cidade (
    id bigint NOT NULL,
    base_id character varying NOT NULL,
    data_pt_br character varying NOT NULL,
    cidade character varying NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    entregues integer DEFAULT 0 NOT NULL,
    em_rota integer DEFAULT 0 NOT NULL,
    ocorrencias integer DEFAULT 0 NOT NULL,
    faltantes integer DEFAULT 0 NOT NULL,
    outros integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.shopee_sla_cidade_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shopee_sla_cidade_id_seq OWNED BY public.shopee_sla_cidade.id;

CREATE TABLE public.shopee_sla_driver_cidade (
    id bigint NOT NULL,
    base_id character varying NOT NULL,
    data_pt_br character varying NOT NULL,
    driver_id character varying NOT NULL,
    driver_name character varying NOT NULL,
    cidade character varying DEFAULT ''::character varying NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.shopee_sla_driver_cidade_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shopee_sla_driver_cidade_id_seq OWNED BY public.shopee_sla_driver_cidade.id;

CREATE TABLE public.shopee_sla_outros_item (
    id bigint NOT NULL,
    base_id character varying NOT NULL,
    data_pt_br character varying NOT NULL,
    cidade character varying DEFAULT ''::character varying NOT NULL,
    status character varying DEFAULT ''::character varying NOT NULL,
    codigo character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.shopee_sla_outros_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shopee_sla_outros_item_id_seq OWNED BY public.shopee_sla_outros_item.id;

CREATE TABLE public.shopee_sla_record (
    id bigint NOT NULL,
    base_id character varying NOT NULL,
    data_pt_br character varying NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    entregues integer DEFAULT 0 NOT NULL,
    em_rota integer DEFAULT 0 NOT NULL,
    ocorrencias integer DEFAULT 0 NOT NULL,
    faltantes integer DEFAULT 0 NOT NULL,
    outros integer DEFAULT 0 NOT NULL,
    sla_pct numeric(5,2) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    por_status jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE SEQUENCE public.shopee_sla_record_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shopee_sla_record_id_seq OWNED BY public.shopee_sla_record.id;

CREATE TABLE public.shopee_stuck_checkpoint (
    id bigint NOT NULL,
    base_id character varying NOT NULL,
    upload_id character varying,
    seq integer NOT NULL,
    data_pt_br character varying NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    label character varying NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    ainda_stuck integer DEFAULT 0 NOT NULL,
    resolvidos integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.shopee_stuck_checkpoint_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shopee_stuck_checkpoint_id_seq OWNED BY public.shopee_stuck_checkpoint.id;

CREATE TABLE public.shopee_stuck_snapshot (
    id bigint NOT NULL,
    base_id character varying NOT NULL,
    data_pt_br character varying NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    total_stuck integer DEFAULT 0 NOT NULL,
    entregues_no_dia integer DEFAULT 0 NOT NULL,
    por_status jsonb,
    por_motorista jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.shopee_stuck_snapshot_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shopee_stuck_snapshot_id_seq OWNED BY public.shopee_stuck_snapshot.id;

CREATE TABLE public.shopee_upload_log (
    id bigint NOT NULL,
    user_email character varying,
    kind character varying NOT NULL,
    filenames text,
    rows integer DEFAULT 0 NOT NULL,
    summary text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.shopee_upload_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shopee_upload_log_id_seq OWNED BY public.shopee_upload_log.id;

CREATE TABLE public.sla_ds_record (
    id character varying DEFAULT (gen_random_uuid())::text NOT NULL,
    base_id character varying NOT NULL,
    upload_id character varying,
    user_id character varying,
    ts timestamp without time zone NOT NULL,
    data_pt_br character varying NOT NULL,
    sla_pct double precision,
    sla_rec integer,
    sla_ent integer,
    ds_pct double precision,
    ds_rec integer,
    ds_ent integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.snapshot (
    id character varying DEFAULT (gen_random_uuid())::text NOT NULL,
    base_id character varying NOT NULL,
    user_id character varying,
    ts timestamp without time zone NOT NULL,
    data_pt_br character varying NOT NULL,
    hora character varying,
    sla_pct double precision,
    ds_pct double precision,
    total integer DEFAULT 0 NOT NULL,
    entregues integer DEFAULT 0 NOT NULL,
    em_rota integer DEFAULT 0 NOT NULL,
    ocorrencias integer DEFAULT 0 NOT NULL,
    faltantes integer DEFAULT 0 NOT NULL,
    devolvidos integer DEFAULT 0 NOT NULL,
    outros integer DEFAULT 0 NOT NULL,
    upload_csv_id character varying,
    upload_xlsx_id character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.snapshot_driver (
    id character varying DEFAULT (gen_random_uuid())::text NOT NULL,
    snapshot_id character varying NOT NULL,
    driver_id character varying,
    driver_name character varying NOT NULL,
    saiu integer DEFAULT 0 NOT NULL,
    entregues integer DEFAULT 0 NOT NULL,
    em_rota integer DEFAULT 0 NOT NULL,
    ocorrencias integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.upload (
    id character varying DEFAULT (gen_random_uuid())::text NOT NULL,
    user_id character varying,
    base_id character varying NOT NULL,
    kind character varying NOT NULL,
    filename character varying NOT NULL,
    size_bytes integer DEFAULT 0 NOT NULL,
    rows_parsed integer DEFAULT 0 NOT NULL,
    rows_kept integer DEFAULT 0 NOT NULL,
    rows_rejected integer DEFAULT 0 NOT NULL,
    error_log character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT upload_kind_check CHECK (((kind)::text = ANY ((ARRAY['CSV_SLA'::character varying, 'XLSX_DS'::character varying, 'XLSX_SLA_DS_HISTORY'::character varying, 'XLSX_BACKLOG'::character varying, 'CSV_STUCK_TRACK'::character varying, 'XLSX_FLEETS'::character varying, 'CSV_PNR'::character varying])::text[])))
);

CREATE TABLE public.user_base (
    user_id character varying NOT NULL,
    base_id character varying NOT NULL
);

ALTER TABLE ONLY public.shopee_base_cidade ALTER COLUMN id SET DEFAULT nextval('public.shopee_base_cidade_id_seq'::regclass);

ALTER TABLE ONLY public.shopee_ds_checkpoint ALTER COLUMN id SET DEFAULT nextval('public.shopee_ds_checkpoint_id_seq'::regclass);

ALTER TABLE ONLY public.shopee_ds_driver ALTER COLUMN id SET DEFAULT nextval('public.shopee_ds_driver_id_seq'::regclass);

ALTER TABLE ONLY public.shopee_package ALTER COLUMN id SET DEFAULT nextval('public.shopee_package_id_seq'::regclass);

ALTER TABLE ONLY public.shopee_package_event ALTER COLUMN id SET DEFAULT nextval('public.shopee_package_event_id_seq'::regclass);

ALTER TABLE ONLY public.shopee_sla_checkpoint ALTER COLUMN id SET DEFAULT nextval('public.shopee_sla_checkpoint_id_seq'::regclass);

ALTER TABLE ONLY public.shopee_sla_cidade ALTER COLUMN id SET DEFAULT nextval('public.shopee_sla_cidade_id_seq'::regclass);

ALTER TABLE ONLY public.shopee_sla_driver_cidade ALTER COLUMN id SET DEFAULT nextval('public.shopee_sla_driver_cidade_id_seq'::regclass);

ALTER TABLE ONLY public.shopee_sla_outros_item ALTER COLUMN id SET DEFAULT nextval('public.shopee_sla_outros_item_id_seq'::regclass);

ALTER TABLE ONLY public.shopee_sla_record ALTER COLUMN id SET DEFAULT nextval('public.shopee_sla_record_id_seq'::regclass);

ALTER TABLE ONLY public.shopee_stuck_checkpoint ALTER COLUMN id SET DEFAULT nextval('public.shopee_stuck_checkpoint_id_seq'::regclass);

ALTER TABLE ONLY public.shopee_stuck_snapshot ALTER COLUMN id SET DEFAULT nextval('public.shopee_stuck_snapshot_id_seq'::regclass);

ALTER TABLE ONLY public.shopee_upload_log ALTER COLUMN id SET DEFAULT nextval('public.shopee_upload_log_id_seq'::regclass);

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_email_key UNIQUE (email);

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.base
    ADD CONSTRAINT base_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cep_cache
    ADD CONSTRAINT cep_cache_pkey PRIMARY KEY (cep);

ALTER TABLE ONLY public.driver
    ADD CONSTRAINT driver_operacao_id_normalized_key_key UNIQUE (operacao_id, normalized_key);

ALTER TABLE ONLY public.driver
    ADD CONSTRAINT driver_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.liberacao
    ADD CONSTRAINT liberacao_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.operacao
    ADD CONSTRAINT operacao_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.operacao
    ADD CONSTRAINT operacao_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.package
    ADD CONSTRAINT package_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopee_base_cidade
    ADD CONSTRAINT shopee_base_cidade_base_id_cidade_key UNIQUE (base_id, cidade);

ALTER TABLE ONLY public.shopee_base_cidade
    ADD CONSTRAINT shopee_base_cidade_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopee_ds_checkpoint
    ADD CONSTRAINT shopee_ds_checkpoint_base_id_data_pt_br_seq_key UNIQUE (base_id, data_pt_br, seq);

ALTER TABLE ONLY public.shopee_ds_checkpoint
    ADD CONSTRAINT shopee_ds_checkpoint_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopee_ds_driver
    ADD CONSTRAINT shopee_ds_driver_base_id_data_pt_br_driver_id_key UNIQUE (base_id, data_pt_br, driver_id);

ALTER TABLE ONLY public.shopee_ds_driver
    ADD CONSTRAINT shopee_ds_driver_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopee_package
    ADD CONSTRAINT shopee_package_base_id_codigo_key UNIQUE (base_id, codigo);

ALTER TABLE ONLY public.shopee_package_event
    ADD CONSTRAINT shopee_package_event_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopee_package
    ADD CONSTRAINT shopee_package_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopee_pnr
    ADD CONSTRAINT shopee_pnr_pkey PRIMARY KEY (spxtn);

ALTER TABLE ONLY public.shopee_sla_checkpoint
    ADD CONSTRAINT shopee_sla_checkpoint_base_id_data_pt_br_seq_key UNIQUE (base_id, data_pt_br, seq);

ALTER TABLE ONLY public.shopee_sla_checkpoint
    ADD CONSTRAINT shopee_sla_checkpoint_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopee_sla_cidade
    ADD CONSTRAINT shopee_sla_cidade_base_id_data_pt_br_cidade_key UNIQUE (base_id, data_pt_br, cidade);

ALTER TABLE ONLY public.shopee_sla_cidade
    ADD CONSTRAINT shopee_sla_cidade_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopee_sla_driver_cidade
    ADD CONSTRAINT shopee_sla_driver_cidade_base_id_data_pt_br_driver_id_key UNIQUE (base_id, data_pt_br, driver_id);

ALTER TABLE ONLY public.shopee_sla_driver_cidade
    ADD CONSTRAINT shopee_sla_driver_cidade_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopee_sla_outros_item
    ADD CONSTRAINT shopee_sla_outros_item_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopee_sla_record
    ADD CONSTRAINT shopee_sla_record_base_id_data_pt_br_key UNIQUE (base_id, data_pt_br);

ALTER TABLE ONLY public.shopee_sla_record
    ADD CONSTRAINT shopee_sla_record_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopee_stuck_checkpoint
    ADD CONSTRAINT shopee_stuck_checkpoint_base_id_data_pt_br_seq_key UNIQUE (base_id, data_pt_br, seq);

ALTER TABLE ONLY public.shopee_stuck_checkpoint
    ADD CONSTRAINT shopee_stuck_checkpoint_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopee_stuck_snapshot
    ADD CONSTRAINT shopee_stuck_snapshot_base_id_data_pt_br_key UNIQUE (base_id, data_pt_br);

ALTER TABLE ONLY public.shopee_stuck_snapshot
    ADD CONSTRAINT shopee_stuck_snapshot_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shopee_upload_log
    ADD CONSTRAINT shopee_upload_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sla_ds_record
    ADD CONSTRAINT sla_ds_record_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.snapshot_driver
    ADD CONSTRAINT snapshot_driver_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.snapshot
    ADD CONSTRAINT snapshot_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.upload
    ADD CONSTRAINT upload_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.base
    ADD CONSTRAINT uq_base_op_slug UNIQUE (operacao_id, slug);

ALTER TABLE ONLY public.package
    ADD CONSTRAINT uq_package_base_codigo UNIQUE (base_id, codigo);

ALTER TABLE ONLY public.sla_ds_record
    ADD CONSTRAINT uq_sla_ds_base_dia UNIQUE (base_id, data_pt_br);

ALTER TABLE ONLY public.snapshot
    ADD CONSTRAINT uq_snapshot_base_dia UNIQUE (base_id, data_pt_br);

ALTER TABLE ONLY public.user_base
    ADD CONSTRAINT user_base_pkey PRIMARY KEY (user_id, base_id);

CREATE INDEX idx_app_user_approval_status ON public.app_user USING btree (approval_status);

CREATE INDEX idx_driver_operacao ON public.driver USING btree (operacao_id);

CREATE INDEX idx_driver_spx ON public.driver USING btree (spx_driver_id);

CREATE INDEX idx_shopee_base_cidade ON public.shopee_base_cidade USING btree (base_id);

CREATE INDEX idx_shopee_ds_ckpt_base ON public.shopee_ds_checkpoint USING btree (base_id, data_pt_br, seq);

CREATE INDEX idx_shopee_ds_driver_base ON public.shopee_ds_driver USING btree (base_id, data_pt_br);

CREATE INDEX idx_shopee_package_backlog_date ON public.shopee_package USING btree (base_id, last_backlog_date);

CREATE INDEX idx_shopee_package_base ON public.shopee_package USING btree (base_id, status);

CREATE INDEX idx_shopee_package_driver ON public.shopee_package USING btree (driver_id);

CREATE INDEX idx_shopee_package_event_pkg ON public.shopee_package_event USING btree (package_id, observed_at);

CREATE INDEX idx_shopee_pnr_driver ON public.shopee_pnr USING btree (driver_id);

CREATE INDEX idx_shopee_pnr_status ON public.shopee_pnr USING btree (status);

CREATE INDEX idx_shopee_sla_cidade ON public.shopee_sla_cidade USING btree (base_id, data_pt_br);

CREATE INDEX idx_shopee_sla_ckpt_base ON public.shopee_sla_checkpoint USING btree (base_id, data_pt_br, seq);

CREATE INDEX idx_shopee_sla_driver_cidade ON public.shopee_sla_driver_cidade USING btree (base_id, data_pt_br);

CREATE INDEX idx_shopee_sla_outros ON public.shopee_sla_outros_item USING btree (base_id, data_pt_br);

CREATE INDEX idx_shopee_sla_record_base ON public.shopee_sla_record USING btree (base_id, data_pt_br);

CREATE INDEX idx_shopee_stuck_ckpt_base ON public.shopee_stuck_checkpoint USING btree (base_id, data_pt_br, seq);

CREATE INDEX idx_shopee_stuck_snapshot_base ON public.shopee_stuck_snapshot USING btree (base_id, ts);

CREATE INDEX idx_shopee_upload_log_created ON public.shopee_upload_log USING btree (created_at DESC);

CREATE INDEX ix_base_operacao_id ON public.base USING btree (operacao_id);

CREATE INDEX ix_liberacao_base_id ON public.liberacao USING btree (base_id);

CREATE INDEX ix_package_base_id ON public.package USING btree (base_id);

CREATE INDEX ix_sla_ds_record_base_id ON public.sla_ds_record USING btree (base_id);

CREATE INDEX ix_snapshot_base_id ON public.snapshot USING btree (base_id);

CREATE INDEX ix_snapshot_driver_snapshot_id ON public.snapshot_driver USING btree (snapshot_id);

CREATE INDEX ix_upload_base_id ON public.upload USING btree (base_id);

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_operacao_id_fkey FOREIGN KEY (operacao_id) REFERENCES public.operacao(id);

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_principal_operacao_id_fkey FOREIGN KEY (principal_operacao_id) REFERENCES public.operacao(id);

ALTER TABLE ONLY public.base
    ADD CONSTRAINT base_operacao_id_fkey FOREIGN KEY (operacao_id) REFERENCES public.operacao(id);

ALTER TABLE ONLY public.driver
    ADD CONSTRAINT driver_operacao_id_fkey FOREIGN KEY (operacao_id) REFERENCES public.operacao(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.liberacao
    ADD CONSTRAINT liberacao_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id);

ALTER TABLE ONLY public.liberacao
    ADD CONSTRAINT liberacao_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id);

ALTER TABLE ONLY public.package
    ADD CONSTRAINT package_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id);

ALTER TABLE ONLY public.package
    ADD CONSTRAINT package_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.driver(id);

ALTER TABLE ONLY public.package
    ADD CONSTRAINT package_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.upload(id);

ALTER TABLE ONLY public.shopee_base_cidade
    ADD CONSTRAINT shopee_base_cidade_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shopee_ds_checkpoint
    ADD CONSTRAINT shopee_ds_checkpoint_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shopee_ds_driver
    ADD CONSTRAINT shopee_ds_driver_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shopee_ds_driver
    ADD CONSTRAINT shopee_ds_driver_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.driver(id);

ALTER TABLE ONLY public.shopee_package
    ADD CONSTRAINT shopee_package_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shopee_package
    ADD CONSTRAINT shopee_package_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.driver(id);

ALTER TABLE ONLY public.shopee_package_event
    ADD CONSTRAINT shopee_package_event_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.driver(id);

ALTER TABLE ONLY public.shopee_package_event
    ADD CONSTRAINT shopee_package_event_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.shopee_package(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shopee_package_event
    ADD CONSTRAINT shopee_package_event_source_upload_id_fkey FOREIGN KEY (source_upload_id) REFERENCES public.upload(id);

ALTER TABLE ONLY public.shopee_pnr
    ADD CONSTRAINT shopee_pnr_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.shopee_pnr
    ADD CONSTRAINT shopee_pnr_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.driver(id);

ALTER TABLE ONLY public.shopee_sla_checkpoint
    ADD CONSTRAINT shopee_sla_checkpoint_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shopee_sla_cidade
    ADD CONSTRAINT shopee_sla_cidade_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shopee_sla_driver_cidade
    ADD CONSTRAINT shopee_sla_driver_cidade_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shopee_sla_driver_cidade
    ADD CONSTRAINT shopee_sla_driver_cidade_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.driver(id);

ALTER TABLE ONLY public.shopee_sla_outros_item
    ADD CONSTRAINT shopee_sla_outros_item_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shopee_sla_record
    ADD CONSTRAINT shopee_sla_record_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shopee_stuck_checkpoint
    ADD CONSTRAINT shopee_stuck_checkpoint_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shopee_stuck_checkpoint
    ADD CONSTRAINT shopee_stuck_checkpoint_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.upload(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.shopee_stuck_snapshot
    ADD CONSTRAINT shopee_stuck_snapshot_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sla_ds_record
    ADD CONSTRAINT sla_ds_record_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id);

ALTER TABLE ONLY public.sla_ds_record
    ADD CONSTRAINT sla_ds_record_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.upload(id);

ALTER TABLE ONLY public.sla_ds_record
    ADD CONSTRAINT sla_ds_record_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id);

ALTER TABLE ONLY public.snapshot
    ADD CONSTRAINT snapshot_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id);

ALTER TABLE ONLY public.snapshot_driver
    ADD CONSTRAINT snapshot_driver_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.driver(id);

ALTER TABLE ONLY public.snapshot_driver
    ADD CONSTRAINT snapshot_driver_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.snapshot(id);

ALTER TABLE ONLY public.snapshot
    ADD CONSTRAINT snapshot_upload_csv_id_fkey FOREIGN KEY (upload_csv_id) REFERENCES public.upload(id);

ALTER TABLE ONLY public.snapshot
    ADD CONSTRAINT snapshot_upload_xlsx_id_fkey FOREIGN KEY (upload_xlsx_id) REFERENCES public.upload(id);

ALTER TABLE ONLY public.snapshot
    ADD CONSTRAINT snapshot_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id);

ALTER TABLE ONLY public.upload
    ADD CONSTRAINT upload_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id);

ALTER TABLE ONLY public.upload
    ADD CONSTRAINT upload_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id);

ALTER TABLE ONLY public.user_base
    ADD CONSTRAINT user_base_base_id_fkey FOREIGN KEY (base_id) REFERENCES public.base(id);

ALTER TABLE ONLY public.user_base
    ADD CONSTRAINT user_base_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id);
