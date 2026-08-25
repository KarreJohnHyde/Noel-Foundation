import {
  type FormEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ConsentField, SelectField, TextAreaField, TextField } from "./components/FormControls";
import HumanVerification from "./components/HumanVerification";
import Icon, { type IconName } from "./components/Icon";
import Logo from "./components/Logo";
import {
  approach,
  contact,
  partnershipModels,
  programs,
  programStories,
  sdgs,
  socialLinks,
  values,
  type Program,
} from "./content";
import {
  backendConfigured,
  fetchPublicImpactMetrics,
  submitPublicForm,
  type ImpactMetric,
  type PublicFormPayload,
} from "./lib/api";

type Navigate = (path: string) => void;
type SubmissionState =
  | { status: "idle" }
  | { status: "sending" }
  | {
      status: "sent";
      reference: string;
    }
  | { status: "fallback"; fallbackHref: string }
  | {
      status: "error";
      message: string;
    };

function readHttpsUrl(configured: string | undefined) {
  const value = configured?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const configuredDonationUrl = readHttpsUrl(import.meta.env.VITE_DONATION_URL as string | undefined);
const DONATION_URL = (() => {
  if (!configuredDonationUrl) return null;
  const url = new URL(configuredDonationUrl);
  const hostname = url.hostname.replace(/^www\./, "");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  return hostname === "noelfoundation.in" && pathname === "/donate" ? null : configuredDonationUrl;
})();
const ANNUAL_REPORT_URL = readHttpsUrl(
  import.meta.env.VITE_ANNUAL_REPORT_2019_20_URL as string | undefined,
);

const pageTitles: Record<string, string> = {
  "/": "Noel Foundation | Human First. Impact Driven.",
  "/about": "About Noel Foundation",
  "/about/story": "Our Story | Noel Foundation",
  "/about/team": "Leadership | Noel Foundation",
  "/about/governance": "Governance | Noel Foundation",
  "/programs": "Our Programs | Noel Foundation",
  "/programs/childrens-health": "Children's Health | Noel Foundation",
  "/programs/education": "Education | Noel Foundation",
  "/programs/womens-livelihoods": "Women's Livelihoods | Noel Foundation",
  "/impact": "Our Impact | Noel Foundation",
  "/impact/live": "Verified Impact | Noel Foundation",
  "/stories": "Stories | Noel Foundation",
  "/events": "Events & Updates | Noel Foundation",
  "/csr": "CSR Partnerships | Noel Foundation",
  "/volunteer": "Volunteer | Noel Foundation",
  "/donate": "Donate | Noel Foundation",
  "/reports": "Reports & Governance | Noel Foundation",
  "/contact": "Contact | Noel Foundation",
  "/privacy": "Privacy | Noel Foundation",
  "/terms": "Terms | Noel Foundation",
  "/refund-policy": "Refund Policy | Noel Foundation",
  "/accessibility": "Accessibility | Noel Foundation",
};

function normalizePath(path: string) {
  const normalized = path.replace(/\/+$/, "") || "/";
  const aliases: Record<string, string> = {
    "/programmes": "/programs",
    "/privacy-statement": "/privacy",
    "/terms-and-conditions": "/terms",
  };
  return aliases[normalized] || normalized;
}

function useNavigation() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const title = pageTitles[path] || "Page not found | Noel Foundation";
    const canonicalUrl = new URL(path === "/" ? "/" : path, contact.website).toString();
    document.title = title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) {
      description.content =
        path === "/"
          ? "Noel Foundation partners with communities and responsible organisations across children's health, education and women's livelihoods."
          : "Explore Noel Foundation's human-first programs, transparent impact approach and ways to partner, volunteer or give.";
    }
    document
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.setAttribute("href", canonicalUrl);
    document
      .querySelector<HTMLMetaElement>('meta[property="og:url"]')
      ?.setAttribute("content", canonicalUrl);
    document
      .querySelector<HTMLMetaElement>('meta[property="og:title"]')
      ?.setAttribute("content", title);
  }, [path]);

  const navigate = useCallback((nextPath: string) => {
    const url = new URL(nextPath, window.location.origin);
    const next = normalizePath(url.pathname);
    if (`${window.location.pathname}${window.location.hash}` !== `${url.pathname}${url.hash}`) {
      window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    setPath(next);
    window.requestAnimationFrame(() => {
      if (url.hash) {
        document.querySelector(url.hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    });
  }, []);

  return { path, navigate };
}

function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(() => window.scrollY > threshold);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [threshold]);
  return scrolled;
}

function usePublicSubmission() {
  const startedAt = useRef(Date.now());
  const submissionId = useRef(crypto.randomUUID());
  const [verificationToken, setVerificationToken] = useState("");
  const [verificationResetKey, setVerificationResetKey] = useState(0);
  const [submission, setSubmission] = useState<SubmissionState>({
    status: "idle",
  });

  const submit = async (payload: Omit<PublicFormPayload, "startedAt" | "submissionId">) => {
    if (backendConfigured && !verificationToken) {
      setSubmission({
        status: "error",
        message: "Please complete the human verification before sending.",
      });
      return;
    }

    setSubmission({ status: "sending" });
    try {
      const result = await submitPublicForm({
        ...payload,
        submissionId: submissionId.current,
        startedAt: startedAt.current,
        turnstileToken: verificationToken || undefined,
      });
      if (result.delivered) {
        setSubmission({ status: "sent", reference: result.reference });
      } else {
        setSubmission({ status: "fallback", fallbackHref: result.fallbackHref });
        window.location.href = result.fallbackHref;
      }
    } catch (error) {
      setSubmission({
        status: "error",
        message: error instanceof Error ? error.message : "We could not send your enquiry.",
      });
    } finally {
      if (backendConfigured) {
        setVerificationToken("");
        setVerificationResetKey((current) => current + 1);
      }
    }
  };

  const reset = () => {
    startedAt.current = Date.now();
    submissionId.current = crypto.randomUUID();
    setVerificationToken("");
    setVerificationResetKey((current) => current + 1);
    setSubmission({ status: "idle" });
  };

  return {
    submission,
    submit,
    reset,
    verificationToken,
    setVerificationToken,
    verificationResetKey,
  };
}

function InternalLink({
  href,
  navigate,
  children,
  className,
  onNavigate,
  ...props
}: {
  href: string;
  navigate: Navigate;
  children: ReactNode;
  className?: string;
  onNavigate?: () => void;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    navigate(href);
    onNavigate?.();
  };

  return (
    <a href={href} className={className} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  invert = false,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  invert?: boolean;
}) {
  return (
    <div
      className={`section-heading section-heading--${align}${
        invert ? " section-heading--invert" : ""
      }`}
    >
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {description ? <p className="section-heading__description">{description}</p> : null}
    </div>
  );
}

function UtilityBar() {
  return (
    <div className="utility-bar">
      <div className="container-shell utility-bar__inner">
        <p>Rooted in Chennai. Working with communities across South India.</p>
        <div className="utility-bar__links">
          <a href={`tel:${contact.phoneHref}`}>
            <Icon name="phone" /> {contact.phoneDisplay}
          </a>
          <a href={`mailto:${contact.email}`}>
            <Icon name="mail" /> {contact.email}
          </a>
        </div>
      </div>
    </div>
  );
}

const aboutLinks = [
  { label: "Mission & approach", href: "/about" },
  { label: "Our story", href: "/about/story" },
  { label: "Leadership", href: "/about/team" },
  { label: "Governance", href: "/about/governance" },
];

const programLinks = programs.map((program) => ({
  label: program.shortTitle,
  href: `/programs/${program.slug}`,
}));

const involveLinks = [
  { label: "Volunteer", href: "/volunteer" },
  { label: "CSR partnership", href: "/csr" },
  { label: "Donate", href: "/donate" },
  { label: "Contact", href: "/contact" },
];

function DesktopMenu({
  label,
  items,
  path,
  navigate,
}: {
  label: string;
  items: { label: string; href: string }[];
  path: string;
  navigate: Navigate;
}) {
  return (
    <details
      className="desktop-menu"
      onToggle={(event) => {
        const current = event.currentTarget;
        if (!current.open) return;
        document.querySelectorAll<HTMLDetailsElement>(".desktop-menu[open]").forEach((menu) => {
          if (menu !== current) menu.open = false;
        });
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }}
    >
      <summary
        onClick={(event) => {
          const current = event.currentTarget.parentElement as HTMLDetailsElement;
          document.querySelectorAll<HTMLDetailsElement>(".desktop-menu[open]").forEach((menu) => {
            if (menu !== current) menu.open = false;
          });
        }}
      >
        {label}
        <Icon name="chevron-down" />
      </summary>
      <div className="desktop-menu__panel">
        {items.map((item) => (
          <InternalLink
            key={item.href}
            href={item.href}
            navigate={navigate}
            aria-current={path === item.href ? "page" : undefined}
            onNavigate={() =>
              document
                .querySelectorAll<HTMLDetailsElement>(".desktop-menu[open]")
                .forEach((menu) => {
                  menu.open = false;
                })
            }
          >
            <span>{item.label}</span>
            <Icon name="arrow-up-right" />
          </InternalLink>
        ))}
      </div>
    </details>
  );
}

function Header({ path, navigate }: { path: string; navigate: Navigate }) {
  const compact = useScrolled(52);
  const [menuOpen, setMenuOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const restoreMenuFocus = useRef(true);

  const closeMenu = (restoreFocus = true) => {
    restoreMenuFocus.current = restoreFocus;
    setMenuOpen(false);
  };

  useEffect(() => {
    document.querySelectorAll<HTMLDetailsElement>(".desktop-menu[open]").forEach((menu) => {
      menu.open = false;
    });
  }, [path]);

  useEffect(() => {
    const closeDesktopMenus = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".desktop-menu")) return;
      document.querySelectorAll<HTMLDetailsElement>(".desktop-menu[open]").forEach((menu) => {
        menu.open = false;
      });
    };
    document.addEventListener("pointerdown", closeDesktopMenus);
    return () => document.removeEventListener("pointerdown", closeDesktopMenus);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const background = document.querySelectorAll<HTMLElement>(
      ".utility-bar, .site-nav, #main-content, .site-footer, .floating-actions",
    );
    document.body.style.overflow = "hidden";
    background.forEach((element) => {
      element.inert = true;
    });
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        menuPanelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hidden);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach((element) => {
        element.inert = false;
      });
      window.removeEventListener("keydown", onKeyDown);
      if (restoreMenuFocus.current) openButtonRef.current?.focus();
    };
  }, [menuOpen]);

  const linkClass = (href: string) =>
    path === href || (href !== "/" && path.startsWith(`${href}/`))
      ? "nav-link nav-link--active"
      : "nav-link";

  return (
    <header className={compact ? "site-header site-header--compact" : "site-header"}>
      <UtilityBar />
      <div className="site-nav">
        <div className="container-shell site-nav__inner">
          <InternalLink
            href="/"
            navigate={navigate}
            className="site-nav__brand"
            aria-label="Noel Foundation home"
            aria-current={path === "/" ? "page" : undefined}
          >
            <Logo />
          </InternalLink>

          <nav className="desktop-nav" aria-label="Primary navigation">
            <DesktopMenu label="About" items={aboutLinks} path={path} navigate={navigate} />
            <DesktopMenu label="Programs" items={programLinks} path={path} navigate={navigate} />
            <InternalLink
              href="/impact"
              navigate={navigate}
              className={linkClass("/impact")}
              aria-current={path === "/impact" ? "page" : undefined}
            >
              Impact
            </InternalLink>
            <InternalLink
              href="/stories"
              navigate={navigate}
              className={linkClass("/stories")}
              aria-current={path === "/stories" ? "page" : undefined}
            >
              Stories
            </InternalLink>
            <InternalLink
              href="/csr"
              navigate={navigate}
              className={linkClass("/csr")}
              aria-current={path === "/csr" ? "page" : undefined}
            >
              CSR
            </InternalLink>
            <DesktopMenu
              label="Get involved"
              items={involveLinks}
              path={path}
              navigate={navigate}
            />
            <InternalLink
              href="/reports"
              navigate={navigate}
              className={linkClass("/reports")}
              aria-current={path === "/reports" ? "page" : undefined}
            >
              Reports
            </InternalLink>
          </nav>

          <div className="site-nav__actions">
            <InternalLink
              href="/donate"
              navigate={navigate}
              className="button button--primary nav-donate"
              aria-current={path === "/donate" ? "page" : undefined}
            >
              Donate <Icon name="heart" />
            </InternalLink>
            <button
              ref={openButtonRef}
              type="button"
              className="icon-button mobile-menu-button"
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => {
                restoreMenuFocus.current = true;
                setMenuOpen(true);
              }}
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </div>

      {menuOpen ? (
        <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            className="mobile-menu__backdrop"
            aria-label="Close navigation menu"
            onClick={() => closeMenu()}
          />
          <div ref={menuPanelRef} className="mobile-menu__panel" id="mobile-navigation">
            <div className="mobile-menu__head">
              <Logo />
              <button
                ref={closeButtonRef}
                type="button"
                className="icon-button"
                aria-label="Close navigation menu"
                onClick={() => closeMenu()}
              >
                <Icon name="close" />
              </button>
            </div>
            <nav aria-label="Mobile navigation">
              <InternalLink
                href="/"
                navigate={navigate}
                aria-current={path === "/" ? "page" : undefined}
                onNavigate={() => closeMenu(false)}
              >
                Home
              </InternalLink>
              <p className="mobile-menu__label">About</p>
              {aboutLinks.map((item) => (
                <InternalLink
                  key={item.href}
                  href={item.href}
                  navigate={navigate}
                  aria-current={path === item.href ? "page" : undefined}
                  onNavigate={() => closeMenu(false)}
                >
                  {item.label}
                </InternalLink>
              ))}
              <p className="mobile-menu__label">Programs</p>
              {programLinks.map((item) => (
                <InternalLink
                  key={item.href}
                  href={item.href}
                  navigate={navigate}
                  aria-current={path === item.href ? "page" : undefined}
                  onNavigate={() => closeMenu(false)}
                >
                  {item.label}
                </InternalLink>
              ))}
              <p className="mobile-menu__label">Explore</p>
              {[
                { label: "Impact", href: "/impact" },
                { label: "Stories", href: "/stories" },
                { label: "CSR partnerships", href: "/csr" },
                { label: "Volunteer", href: "/volunteer" },
                { label: "Reports", href: "/reports" },
                { label: "Contact", href: "/contact" },
              ].map((item) => (
                <InternalLink
                  key={item.href}
                  href={item.href}
                  navigate={navigate}
                  aria-current={path === item.href ? "page" : undefined}
                  onNavigate={() => closeMenu(false)}
                >
                  {item.label}
                </InternalLink>
              ))}
            </nav>
            <InternalLink
              href="/donate"
              navigate={navigate}
              className="button button--primary button--wide"
              aria-current={path === "/donate" ? "page" : undefined}
              onNavigate={() => closeMenu(false)}
            >
              Donate now <Icon name="heart" />
            </InternalLink>
            <div className="mobile-menu__contact">
              <a href={`tel:${contact.phoneHref}`}>{contact.phoneDisplay}</a>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Hero({ navigate }: { navigate: Navigate }) {
  return (
    <section className="home-hero">
      <div className="home-hero__glow home-hero__glow--one" />
      <div className="home-hero__glow home-hero__glow--two" />
      <div className="container-shell home-hero__grid">
        <div className="home-hero__copy">
          <p className="eyebrow eyebrow--pill">
            <span /> CSR partnerships for health, education & livelihoods
          </p>
          <h1>
            Creating <em>measurable</em> impact.
          </h1>
          <p className="home-hero__lead">Transforming lives. Building sustainable futures.</p>
          <p className="home-hero__body">
            Noel Foundation works with corporates, institutions and socially responsible
            organisations to address critical challenges affecting vulnerable communities through
            three connected programs.
          </p>
          <div className="button-row">
            <InternalLink
              href="/csr"
              navigate={navigate}
              className="button button--primary button--large"
            >
              Partner with us <Icon name="arrow" />
            </InternalLink>
            <InternalLink
              href="/programs"
              navigate={navigate}
              className="button button--secondary button--large"
            >
              Explore programs
            </InternalLink>
          </div>
          <InternalLink
            href="/donate"
            navigate={navigate}
            className="text-link home-hero__support-link"
          >
            Support our work <Icon name="arrow-up-right" />
          </InternalLink>
          <div className="home-hero__principles" aria-label="Noel Foundation commitments">
            <span>
              <Icon name="verified" /> Verified data only
            </span>
            <span>
              <Icon name="shield" /> Privacy-aware stories
            </span>
          </div>
        </div>

        <div className="home-hero__visual">
          <div className="hero-photo">
            <img
              src="/images/community-relief.jpg"
              alt="Noel Foundation team members delivering essential support during a community outreach initiative"
              width="900"
              height="674"
              fetchPriority="high"
            />
            <div className="hero-photo__caption">
              <span className="live-dot" />
              Community-led action in Chennai
            </div>
          </div>
          <div className="hero-program hero-program--health">
            <span className="hero-program__icon">
              <Icon name="heart" />
            </span>
            <span>
              <strong>Children's Health</strong>
              <small>Care coordination</small>
            </span>
          </div>
          <div className="hero-program hero-program--education">
            <span className="hero-program__icon">
              <Icon name="report" />
            </span>
            <span>
              <strong>Education</strong>
              <small>Pathways to learning</small>
            </span>
          </div>
          <div className="hero-program hero-program--livelihoods">
            <span className="hero-program__icon">
              <Icon name="leaf" />
            </span>
            <span>
              <strong>Women's Livelihoods</strong>
              <small>Skills to income</small>
            </span>
          </div>
          <div className="hero-note">
            <strong>Human first.</strong>
            <span>Impact driven.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustRail() {
  const items: { icon: IconName; title: string; detail: string }[] = [
    {
      icon: "shield",
      title: "Responsible governance",
      detail: "Stewardship built into delivery",
    },
    {
      icon: "report",
      title: "Transparent reporting",
      detail: "Program and outcome visibility",
    },
    {
      icon: "verified",
      title: "Verified data only",
      detail: "No unapproved public figures",
    },
    {
      icon: "people",
      title: "Community-centred",
      detail: "Solutions shaped around real needs",
    },
  ];
  return (
    <section className="trust-rail" aria-label="Our commitments">
      <div className="container-shell trust-rail__grid">
        {items.map((item) => (
          <div key={item.title} className="trust-item">
            <span className="trust-item__icon">
              <Icon name={item.icon} />
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhyNoel() {
  return (
    <section className="section section--cream">
      <div className="container-shell">
        <SectionHeading
          eyebrow="Why Noel Foundation"
          title={
            <>
              Turning CSR commitment into <em>community impact.</em>
            </>
          }
          description="For responsible organisations, social investment is an opportunity to build focused, measurable and sustainable change."
          align="center"
        />
        <div className="values-grid">
          {values.map((value, index) => (
            <article key={value.title} className="value-card">
              <span className="value-card__number">0{index + 1}</span>
              <span className="value-card__icon">
                <Icon name={value.icon as IconName} />
              </span>
              <h3>{value.title}</h3>
              <p>{value.description}</p>
            </article>
          ))}
        </div>
        <p className="section-note">We help companies move from CSR spending to CSR impact.</p>
      </div>
    </section>
  );
}

function ProgramCards({ navigate }: { navigate: Navigate }) {
  return (
    <section className="section" id="programs">
      <div className="container-shell">
        <div className="section-intro-row">
          <SectionHeading
            eyebrow="Three connected programs"
            title={
              <>
                Healthier children. Educated communities. <em>Empowered families.</em>
              </>
            }
            description="Each program responds to a different barrier, while contributing to one connected pathway toward dignity and opportunity."
          />
          <InternalLink href="/programs" navigate={navigate} className="button button--secondary">
            View all programs <Icon name="arrow" />
          </InternalLink>
        </div>
        <div className="program-grid">
          {programs.map((program, index) => (
            <InternalLink
              key={program.slug}
              href={`/programs/${program.slug}`}
              navigate={navigate}
              className="program-card"
              style={
                {
                  "--program-accent": program.accent,
                  "--program-soft": program.soft,
                } as React.CSSProperties
              }
            >
              <div className="program-card__image">
                <img
                  src={program.image}
                  alt={program.imageAlt}
                  width="900"
                  height="674"
                  loading="lazy"
                />
                <span>0{index + 1}</span>
              </div>
              <div className="program-card__content">
                <p className="program-card__eyebrow">{program.eyebrow}</p>
                <h3>{program.title}</h3>
                <p>{program.summary}</p>
                <span className="program-card__link">
                  Explore the program <Icon name="arrow" />
                </span>
              </div>
            </InternalLink>
          ))}
        </div>
      </div>
    </section>
  );
}

function Approach() {
  return (
    <section className="section section--ink">
      <div className="container-shell">
        <SectionHeading
          eyebrow="How impact is built"
          title={
            <>
              From investment to <em>lasting change.</em>
            </>
          }
          description="A practical pathway for designing, delivering and strengthening community programs over time."
          invert
        />
        <div className="approach-grid">
          {approach.map((step, index) => (
            <article key={step.title} className="approach-step">
              <div className="approach-step__top">
                <span>{step.number}</span>
                {index < approach.length - 1 ? <Icon name="arrow" /> : <Icon name="verified" />}
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const fallbackMetricLabels = [
  {
    label: "Children receiving health support",
    programme: "Children's Health",
  },
  { label: "Active educational sponsorships", programme: "Education" },
  { label: "Women trained or equipped", programme: "Women's Livelihoods" },
  { label: "Completed contributions", programme: "Verified donations only" },
];

function MetricValue({ metric }: { metric: ImpactMetric }) {
  const value = new Intl.NumberFormat("en-IN").format(metric.value);
  return (
    <>
      {value}
      {metric.unit ? <small>{metric.unit}</small> : null}
    </>
  );
}

function ImpactMetrics({ compact = false }: { compact?: boolean }) {
  const [metrics, setMetrics] = useState<ImpactMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchPublicImpactMetrics()
      .then((records) => {
        if (active) setMetrics(records);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={compact ? "metric-grid metric-grid--compact" : "metric-grid"}>
      {metrics.length > 0
        ? metrics.map((metric) => (
            <article key={metric.key} className="metric-card">
              <div className="metric-card__head">
                <span className="live-dot" />
                <span>Verified</span>
              </div>
              <strong>
                <MetricValue metric={metric} />
              </strong>
              <h3>{metric.label}</h3>
              <p>{metric.description || metric.programme || "Verified program record"}</p>
              <small>
                Updated{" "}
                {new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                }).format(new Date(metric.updated_at))}
              </small>
            </article>
          ))
        : fallbackMetricLabels.map((metric) => (
            <article key={metric.label} className="metric-card metric-card--pending">
              <div className="metric-card__head">
                <Icon name="shield" />
                <span>Verification first</span>
              </div>
              <strong aria-label="Awaiting verified publication">—</strong>
              <h3>{metric.label}</h3>
              <p>{metric.programme}</p>
              <small>
                {loading ? "Checking verified records..." : "Awaiting verified publication"}
              </small>
            </article>
          ))}
    </div>
  );
}

function ImpactPreview({ navigate }: { navigate: Navigate }) {
  return (
    <section className="section section--sand" id="impact">
      <div className="container-shell">
        <div className="impact-header">
          <SectionHeading
            eyebrow="Public impact layer"
            title={
              <>
                Impact should be seen. <em>Measured. Reported.</em>
              </>
            }
            description="Public figures appear only after a record is verified and approved for publication. This protects donor trust and program integrity."
          />
          <div className="verification-badge">
            <Icon name="verified" />
            <span>
              <strong>Verification-first</strong>
              <small>No demo numbers presented as impact</small>
            </span>
          </div>
        </div>
        <ImpactMetrics />
        <div className="impact-footer">
          <p>
            {backendConfigured
              ? "Verified records are connected to the public data layer."
              : "The public data layer is ready for Noel Foundation's approved records."}
          </p>
          <InternalLink href="/impact/live" navigate={navigate} className="button button--dark">
            Explore verified impact <Icon name="arrow" />
          </InternalLink>
        </div>
      </div>
    </section>
  );
}

function StoryShowcase({ navigate }: { navigate: Navigate }) {
  const [index, setIndex] = useState(0);
  const story = programStories[index];
  const move = (direction: number) =>
    setIndex((current) => (current + direction + programStories.length) % programStories.length);

  return (
    <section className="section story-section">
      <div className="container-shell">
        <SectionHeading
          eyebrow="Program stories"
          title={
            <>
              People are always more important than <em>the platform.</em>
            </>
          }
          description="These program lenses explain how support can move through a person's journey without publishing private medical or family details."
        />
        <div
          className="story-showcase"
          role="region"
          aria-roledescription="carousel"
          aria-label="Program stories"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") move(-1);
            if (event.key === "ArrowRight") move(1);
          }}
        >
          <div className="story-showcase__image">
            <img src={story.image} alt={story.imageAlt} width="900" height="674" loading="lazy" />
            <span>
              {String(index + 1).padStart(2, "0")} /{" "}
              {String(programStories.length).padStart(2, "0")}
            </span>
          </div>
          <div className="story-showcase__copy" aria-live="polite">
            <p className="eyebrow">{story.tag}</p>
            <h3>{story.title}</h3>
            <p>{story.description}</p>
            <InternalLink href={story.href} navigate={navigate} className="text-link">
              Explore this program <Icon name="arrow" />
            </InternalLink>
            <div className="story-controls">
              <button
                type="button"
                className="icon-button"
                onClick={() => move(-1)}
                aria-label="Previous story"
              >
                <Icon name="chevron-left" />
              </button>
              <div className="story-dots" aria-label="Choose story">
                {programStories.map((item, itemIndex) => (
                  <button
                    key={item.title}
                    type="button"
                    className={itemIndex === index ? "story-dot story-dot--active" : "story-dot"}
                    aria-label={`Show story ${itemIndex + 1}`}
                    aria-current={itemIndex === index}
                    onClick={() => setIndex(itemIndex)}
                  />
                ))}
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => move(1)}
                aria-label="Next story"
              >
                <Icon name="chevron-right" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CSRPreview({ navigate }: { navigate: Navigate }) {
  return (
    <section className="section csr-preview">
      <div className="container-shell csr-preview__grid">
        <div className="csr-preview__copy">
          <SectionHeading
            eyebrow="CSR partnerships"
            title={
              <>
                Your CSR. Our community reach. <em>Shared impact.</em>
              </>
            }
            description="Build a focused partnership around health, education or livelihoods, with a clear path from discovery to reporting."
            invert
          />
          <InternalLink
            href="/csr"
            navigate={navigate}
            className="button button--light button--large"
          >
            Build a CSR partnership <Icon name="arrow" />
          </InternalLink>
        </div>
        <div className="partnership-list">
          {partnershipModels.map((model, index) => (
            <article key={model.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{model.title}</h3>
                <p>{model.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function GovernancePreview({ navigate }: { navigate: Navigate }) {
  const cards: {
    icon: IconName;
    title: string;
    description: string;
    href: string;
  }[] = [
    {
      icon: "report",
      title: "Reports",
      description: "Public program and annual-report archive.",
      href: "/reports",
    },
    {
      icon: "shield",
      title: "Governance",
      description: "Responsible stewardship and documentation.",
      href: "/about/governance",
    },
    {
      icon: "trend",
      title: "Impact approach",
      description: "What is measured and how it is verified.",
      href: "/impact",
    },
  ];
  return (
    <section className="section section--blue">
      <div className="container-shell">
        <div className="section-intro-row">
          <SectionHeading
            eyebrow="Trust through transparency"
            title={
              <>
                Responsible stewardship. <em>Accountable impact.</em>
              </>
            }
            description="Noel Foundation is committed to strong governance, transparent reporting and responsible use of resources."
            invert
          />
        </div>
        <div className="governance-grid">
          {cards.map((card) => (
            <InternalLink key={card.title} href={card.href} navigate={navigate}>
              <span className="governance-card__icon">
                <Icon name={card.icon} />
              </span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <span className="governance-card__link">
                Explore <Icon name="arrow" />
              </span>
            </InternalLink>
          ))}
        </div>
      </div>
    </section>
  );
}

function GetInvolved({ navigate }: { navigate: Navigate }) {
  const cards: {
    icon: IconName;
    title: string;
    description: string;
    href: string;
    cta: string;
  }[] = [
    {
      icon: "heart",
      title: "Give",
      description: "Support a pathway that creates lasting impact.",
      href: "/donate",
      cta: "Donate",
    },
    {
      icon: "people",
      title: "Volunteer",
      description: "Offer time, experience or skills to a program.",
      href: "/volunteer",
      cta: "Join us",
    },
    {
      icon: "layers",
      title: "Partner",
      description: "Co-create a focused CSR or institutional partnership.",
      href: "/csr",
      cta: "Start a conversation",
    },
  ];
  return (
    <section className="section">
      <div className="container-shell">
        <SectionHeading
          eyebrow="Get involved"
          title={
            <>
              One purpose. <em>Many ways to help.</em>
            </>
          }
          description="Choose the path that fits how you want to contribute."
          align="center"
        />
        <div className="involved-grid">
          {cards.map((card) => (
            <InternalLink
              key={card.title}
              href={card.href}
              navigate={navigate}
              className="involved-card"
            >
              <span className="involved-card__icon">
                <Icon name={card.icon} />
              </span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <span>
                {card.cta} <Icon name="arrow" />
              </span>
            </InternalLink>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactForm({ compact = false }: { compact?: boolean }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    organisation: "",
    subject: "",
    message: "",
    consent: false,
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const {
    submission,
    submit,
    reset,
    verificationToken,
    setVerificationToken,
    verificationResetKey,
  } = usePublicSubmission();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const formElement = event.currentTarget as HTMLFormElement;
    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 2) nextErrors.name = "Please enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email))
      nextErrors.email = "Please enter a valid email address.";
    if (!form.subject) nextErrors.subject = "Please choose a subject.";
    if (form.message.trim().length < 10) nextErrors.message = "Please add a short message.";
    if (!form.consent) nextErrors.consent = "Consent is required so we can respond.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      window.requestAnimationFrame(() => {
        formElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    await submit({
      kind: "contact",
      ...form,
      consent: form.consent,
    });
  };

  if (submission.status === "sent") {
    return (
      <div className="form-success" role="status">
        <span>
          <Icon name="check" />
        </span>
        <p className="eyebrow">Message received</p>
        <h3>Thank you for reaching out.</h3>
        <p>Our team will review your message and respond through the contact details you shared.</p>
        <p className="form-reference">Reference: {submission.reference}</p>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => {
            reset();
            setForm({
              name: "",
              email: "",
              phone: "",
              organisation: "",
              subject: "",
              message: "",
              consent: false,
              website: "",
            });
          }}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form
      className={compact ? "form-grid form-grid--compact" : "form-grid"}
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="form-grid__two">
        <TextField
          label="Full name *"
          name="contact-name"
          autoComplete="name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          error={errors.name}
        />
        <TextField
          label="Email address *"
          name="contact-email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          error={errors.email}
        />
      </div>
      <div className="form-grid__two">
        <TextField
          label="Phone"
          name="contact-phone"
          type="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
        <TextField
          label="Organisation"
          name="contact-organisation"
          autoComplete="organization"
          value={form.organisation}
          onChange={(event) => setForm({ ...form, organisation: event.target.value })}
        />
      </div>
      <SelectField
        label="Subject *"
        name="contact-subject"
        value={form.subject}
        onChange={(event) => setForm({ ...form, subject: event.target.value })}
        error={errors.subject}
      >
        <option value="">Choose a subject</option>
        <option>CSR partnership</option>
        <option>Donation</option>
        <option>Volunteer</option>
        <option>Program information</option>
        <option>Media or general enquiry</option>
      </SelectField>
      <TextAreaField
        label="How can we help? *"
        name="contact-message"
        rows={compact ? 4 : 5}
        value={form.message}
        onChange={(event) => setForm({ ...form, message: event.target.value })}
        error={errors.message}
      />
      <label className="honeypot" aria-hidden="true">
        Website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(event) => setForm({ ...form, website: event.target.value })}
        />
      </label>
      <ConsentField
        id={compact ? "home-contact-consent" : "contact-consent"}
        checked={form.consent}
        onChange={(checked) => setForm({ ...form, consent: checked })}
        error={errors.consent}
      >
        I agree to Noel Foundation using these details to respond to my enquiry. *
      </ConsentField>
      {backendConfigured ? (
        <HumanVerification
          action="contact"
          onToken={setVerificationToken}
          resetKey={verificationResetKey}
        />
      ) : null}
      {submission.status === "error" ? (
        <p className="form-alert form-alert--error" role="alert">
          {submission.message}
        </p>
      ) : null}
      {submission.status === "fallback" ? (
        <p className="form-alert" role="status">
          Your email app has been opened with a prepared message. If it did not open,{" "}
          <a href={submission.fallbackHref}>continue by email</a>.
        </p>
      ) : null}
      <div className="form-submit-row">
        <button
          type="submit"
          className="button button--primary button--large"
          disabled={submission.status === "sending" || (backendConfigured && !verificationToken)}
        >
          {submission.status === "sending" ? "Sending..." : "Send message"} <Icon name="arrow" />
        </button>
        {!backendConfigured ? (
          <small>Secure email hand-off is used until the website inbox is connected.</small>
        ) : (
          <small>Your details are sent securely to the Noel Foundation team.</small>
        )}
      </div>
    </form>
  );
}

function ContactSection() {
  return (
    <section className="section section--cream" id="contact">
      <div className="container-shell contact-grid">
        <div className="contact-copy">
          <SectionHeading
            eyebrow="Start a conversation"
            title={
              <>
                Let’s build impact that <em>lasts.</em>
              </>
            }
            description="Tell us whether you are exploring a CSR partnership, volunteering, a program or another way to support."
          />
          <div className="contact-list">
            <a href={`tel:${contact.phoneHref}`}>
              <span>
                <Icon name="phone" />
              </span>
              <div>
                <small>Call us</small>
                <strong>{contact.phoneDisplay}</strong>
              </div>
            </a>
            <a href={`mailto:${contact.email}`}>
              <span>
                <Icon name="mail" />
              </span>
              <div>
                <small>Email us</small>
                <strong>{contact.email}</strong>
              </div>
            </a>
            <div>
              <span>
                <Icon name="pin" />
              </span>
              <div>
                <small>Our location</small>
                <strong>{contact.location}</strong>
              </div>
            </div>
          </div>
        </div>
        <div className="form-card">
          <ContactForm compact />
        </div>
      </div>
    </section>
  );
}

function HomePage({ navigate }: { navigate: Navigate }) {
  return (
    <>
      <Hero navigate={navigate} />
      <TrustRail />
      <WhyNoel />
      <ProgramCards navigate={navigate} />
      <Approach />
      <ImpactPreview navigate={navigate} />
      <StoryShowcase navigate={navigate} />
      <CSRPreview navigate={navigate} />
      <GovernancePreview navigate={navigate} />
      <GetInvolved navigate={navigate} />
      <ContactSection />
    </>
  );
}

function PageHero({
  eyebrow,
  title,
  description,
  image,
  imageAlt,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  image?: string;
  imageAlt?: string;
  children?: ReactNode;
}) {
  return (
    <section className="page-hero">
      <div className="container-shell page-hero__grid">
        <div className="page-hero__copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          {children ? <div className="button-row">{children}</div> : null}
        </div>
        {image ? (
          <div className="page-hero__image">
            <img src={image} alt={imageAlt || ""} width="900" height="674" fetchPriority="high" />
            <span className="page-hero__image-mark">
              <Icon name="spark" />
            </span>
          </div>
        ) : (
          <div className="page-hero__statement">
            <span>
              <Icon name="spark" />
            </span>
            <strong>Human first.</strong>
            <strong>Impact driven.</strong>
            <strong>Transparent.</strong>
          </div>
        )}
      </div>
    </section>
  );
}

function AboutPage({ path, navigate }: { path: string; navigate: Navigate }) {
  const leadership = [
    {
      initials: "HP",
      name: "Hilda Priyadarshini",
      role: "Founder & Managing Trustee",
      description:
        "Her lived experience with pediatric heart care shaped a mission centred on children and families facing the same uncertainty.",
    },
    {
      initials: "SM",
      name: "Sudheer Merugumalla",
      role: "Executive Director",
      description:
        "He provides strategic and operational direction across programs, governance, partnerships and stakeholder engagement.",
    },
  ];

  useEffect(() => {
    const section = path.endsWith("/story")
      ? "our-story"
      : path.endsWith("/team")
        ? "leadership"
        : path.endsWith("/governance")
          ? "governance"
          : "";
    if (section)
      window.requestAnimationFrame(() =>
        document.getElementById(section)?.scrollIntoView({ block: "start" }),
      );
  }, [path]);

  return (
    <>
      <PageHero
        eyebrow="About Noel Foundation"
        title={
          <>
            Compassion made practical. <em>Purpose made measurable.</em>
          </>
        }
        description="Noel Foundation partners with communities and responsible organisations to create healthier children, educated communities and economically empowered families."
        image="/images/outreach-team.jpg"
        imageAlt="Noel Foundation's community outreach team in Chennai"
      >
        <InternalLink href="/programs" navigate={navigate} className="button button--primary">
          Explore our work <Icon name="arrow" />
        </InternalLink>
        <InternalLink href="/contact" navigate={navigate} className="button button--secondary">
          Talk to our team
        </InternalLink>
      </PageHero>

      <section className="section about-purpose">
        <div className="container-shell about-purpose__grid">
          <div>
            <p className="eyebrow">Our mission</p>
            <h2>
              To create healthier children, educated communities and economically empowered
              families.
            </h2>
          </div>
          <div className="about-purpose__copy">
            <p>
              Noel Foundation works across three connected areas: Children's Health, Education and
              Women's Skill Training & Livelihoods.
            </p>
            <p>
              Through strategic partnerships and community-based programs, social investment becomes
              focused action with a pathway to measurable, sustainable impact.
            </p>
          </div>
        </div>
      </section>

      <section className="section section--cream" id="our-story">
        <div className="container-shell origin-grid">
          <div className="origin-photo">
            <img
              src="/images/pediatric-family-support.jpg"
              alt="A child and caregiver during a pediatric care journey"
              width="768"
              height="1024"
              loading="lazy"
            />
            <span>Born from lived experience</span>
          </div>
          <div>
            <SectionHeading
              eyebrow="Our story"
              title={
                <>
                  Born from a difficult journey. <em>Built to stand beside others.</em>
                </>
              }
              description="Noel Foundation's beginnings are rooted in a family's experience of congenital heart disease and the recognition that many families face the same journey without adequate financial or emotional support."
            />
            <div className="prose-stack">
              <p>
                That experience became a wider commitment: help children access care, help
                first-generation learners remain connected to education, and help women build
                sustainable livelihood pathways.
              </p>
              <p>
                Today, the Foundation brings together community insight, institutional relationships
                and responsible partners to move from intention to implementation.
              </p>
            </div>
            <p className="quote-card">“Touching lives, one little heart at a time.”</p>
          </div>
        </div>
      </section>

      <WhyNoel />

      <section className="section" id="leadership">
        <div className="container-shell">
          <SectionHeading
            eyebrow="Leadership"
            title={
              <>
                Purpose-led. <em>Accountability-minded.</em>
              </>
            }
            description="Leadership connects the Foundation's lived purpose with responsible program delivery and partnership stewardship."
          />
          <div className="leadership-grid">
            {leadership.map((person) => (
              <article key={person.name} className="leadership-card">
                <span>{person.initials}</span>
                <div>
                  <h3>{person.name}</h3>
                  <p className="leadership-card__role">{person.role}</p>
                  <p>{person.description}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="source-note">
            Leadership roles reflect Noel Foundation's currently published team and trustee
            information.
          </p>
        </div>
      </section>

      <section className="section section--blue" id="governance">
        <div className="container-shell governance-detail-grid">
          <SectionHeading
            eyebrow="Governance & transparency"
            title={
              <>
                Responsible stewardship. <em>Accountable impact.</em>
              </>
            }
            description="Strong governance, clear records and responsible resource use are central to durable partnerships."
            invert
          />
          <div className="governance-checks">
            {[
              "Applicable statutory registrations and documentation",
              "Financial, programmatic and beneficiary records",
              "Outcome-oriented program reporting",
              "Privacy-aware handling of beneficiary and supporter information",
            ].map((item) => (
              <p key={item}>
                <Icon name="check" /> {item}
              </p>
            ))}
            <InternalLink href="/reports" navigate={navigate} className="button button--light">
              View reports & documents <Icon name="arrow" />
            </InternalLink>
          </div>
        </div>
      </section>
    </>
  );
}

function ProgramDetail({ program, navigate }: { program: Program; navigate: Navigate }) {
  return (
    <>
      <PageHero
        eyebrow={program.eyebrow}
        title={<>{program.title}</>}
        description={program.summary}
        image={program.image}
        imageAlt={program.imageAlt}
      >
        <InternalLink href="/csr" navigate={navigate} className="button button--primary">
          Partner on this program <Icon name="arrow" />
        </InternalLink>
        <InternalLink href="/donate" navigate={navigate} className="button button--secondary">
          Support this work
        </InternalLink>
      </PageHero>
      <section className="section">
        <div className="container-shell program-detail-grid">
          <div>
            <p className="eyebrow">What the program supports</p>
            <h2>A coordinated pathway around the person, not an isolated intervention.</h2>
            <p className="program-statement" style={{ borderColor: program.accent }}>
              {program.statement}
            </p>
          </div>
          <div className="check-list">
            {program.support.map((item) => (
              <p key={item}>
                <Icon name="check" /> {item}
              </p>
            ))}
          </div>
        </div>
      </section>
      {program.focusAreas ? (
        <section className="section section--cream">
          <div className="container-shell">
            <SectionHeading
              eyebrow="Focus areas"
              title="Skills linked to practical earning pathways."
            />
            <div className="pill-grid">
              {program.focusAreas.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      <section className="section section--sand">
        <div className="container-shell csr-options-grid">
          <SectionHeading
            eyebrow="CSR opportunities"
            title={
              <>
                Choose a partnership model that fits your <em>social outcome.</em>
              </>
            }
            description={program.outcome}
          />
          <div className="number-list">
            {program.csrOptions.map((item, index) => (
              <p key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {item}
              </p>
            ))}
          </div>
        </div>
      </section>
      <Approach />
      <GetInvolved navigate={navigate} />
    </>
  );
}

function ProgramsPage({ path, navigate }: { path: string; navigate: Navigate }) {
  const slug = path.split("/")[2];
  const selected = programs.find((program) => program.slug === slug);
  if (selected) return <ProgramDetail program={selected} navigate={navigate} />;
  return (
    <>
      <PageHero
        eyebrow="Our programs"
        title={
          <>
            Three pathways. <em>One connected purpose.</em>
          </>
        }
        description="Health, education and livelihoods respond to different barriers while strengthening the same long-term future: healthier children, educated communities and economically empowered families."
        image="/images/food-kit-distribution.jpg"
        imageAlt="Noel Foundation volunteers and community members during a support distribution initiative"
      >
        <InternalLink href="/csr" navigate={navigate} className="button button--primary">
          Partner with us <Icon name="arrow" />
        </InternalLink>
      </PageHero>
      <ProgramCards navigate={navigate} />
      <Approach />
      <StoryShowcase navigate={navigate} />
    </>
  );
}

function ImpactPage({ path, navigate }: { path: string; navigate: Navigate }) {
  const live = path === "/impact/live";
  const categories = [
    {
      title: "Health",
      items: [
        "Children identified or treated",
        "Surgeries and diagnostic interventions supported",
        "Families supported",
      ],
    },
    {
      title: "Education",
      items: ["Students supported", "School retention", "Resources and mentoring interventions"],
    },
    {
      title: "Livelihoods",
      items: [
        "Women trained or equipped",
        "Employment and micro-enterprise pathways",
        "Income-generation outcomes",
      ],
    },
    {
      title: "Community",
      items: ["Communities reached", "Outreach activities", "Approved or active volunteers"],
    },
  ];
  return (
    <>
      <PageHero
        eyebrow={live ? "Verified public impact" : "Our impact approach"}
        title={
          live ? (
            <>
              Our impact, <em>updated after verification.</em>
            </>
          ) : (
            <>
              Measure what matters. <em>Report what is verified.</em>
            </>
          )
        }
        description={
          live
            ? "Approved program records appear here after review. Medical and beneficiary data is never described as instantaneous, and private information stays private."
            : "Noel Foundation's impact framework connects program delivery, outcome tracking and responsible public reporting."
        }
      >
        <InternalLink href="/reports" navigate={navigate} className="button button--primary">
          View reports <Icon name="arrow" />
        </InternalLink>
        {!live ? (
          <InternalLink
            href="/impact/live"
            navigate={navigate}
            className="button button--secondary"
          >
            View public metrics
          </InternalLink>
        ) : null}
      </PageHero>
      <section className="section section--sand">
        <div className="container-shell">
          <div className="impact-header">
            <SectionHeading
              eyebrow="Verified metrics"
              title={
                <>
                  A public dashboard built around <em>trust.</em>
                </>
              }
              description="Only records marked Verified and approved for public visibility can appear below. Completed donations are the only contributions eligible for public totals."
            />
            <div className="verification-badge">
              <Icon name="shield" />
              <span>
                <strong>Privacy protected</strong>
                <small>No donor or volunteer details are public</small>
              </span>
            </div>
          </div>
          <ImpactMetrics />
        </div>
      </section>
      <section className="section">
        <div className="container-shell">
          <SectionHeading
            eyebrow="What we measure"
            title={
              <>
                Program delivery connected to <em>meaningful outcomes.</em>
              </>
            }
          />
          <div className="measurement-grid">
            {categories.map((category, index) => (
              <article key={category.title}>
                <span>0{index + 1}</span>
                <h3>{category.title}</h3>
                {category.items.map((item) => (
                  <p key={item}>
                    <Icon name="check" /> {item}
                  </p>
                ))}
              </article>
            ))}
          </div>
        </div>
      </section>
      <Approach />
      <section className="section section--cream">
        <div className="container-shell data-policy-grid">
          <SectionHeading
            eyebrow="Impact data policy"
            title="Verified before visible."
            description="A metric remains private while it is drafted or reviewed. Public visibility requires verification, an approved source and an update date."
          />
          <div className="data-policy-flow">
            {[
              ["01", "Recorded", "Program team adds a source-backed record."],
              ["02", "Reviewed", "The record is checked for accuracy and privacy."],
              ["03", "Verified", "An authorised reviewer approves publication."],
              ["04", "Published", "The public dashboard receives the approved value."],
            ].map(([number, title, description]) => (
              <article key={title}>
                <span>{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function StoriesPage({ navigate }: { navigate: Navigate }) {
  const [filter, setFilter] = useState("All");
  const filters = ["All", "Children's Health", "Education", "Community"];
  const visible =
    filter === "All" ? programStories : programStories.filter((story) => story.tag === filter);
  return (
    <>
      <PageHero
        eyebrow="Stories & perspectives"
        title={
          <>
            Human stories, told with <em>dignity.</em>
          </>
        }
        description="Program stories help people understand a journey without exposing private medical, donor, volunteer or family information."
        image="/images/household-relief.jpg"
        imageAlt="A Noel Foundation representative delivering household support during community outreach"
      />
      <section className="section">
        <div className="container-shell stories-layout">
          <aside className="story-filter" aria-label="Filter stories">
            <p className="eyebrow">Filter by program</p>
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                className={
                  filter === item ? "filter-button filter-button--active" : "filter-button"
                }
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item}
                <span>
                  {item === "All"
                    ? programStories.length
                    : programStories.filter((story) => story.tag === item).length}
                </span>
              </button>
            ))}
            <div className="privacy-note">
              <Icon name="shield" />
              <p>
                <strong>Story privacy</strong>Real names, photographs and medical details require
                documented consent before publication.
              </p>
            </div>
          </aside>
          <div className="stories-grid" aria-live="polite">
            {visible.map((story) => (
              <article key={story.title} className="story-card">
                <img
                  src={story.image}
                  alt={story.imageAlt}
                  width="900"
                  height="674"
                  loading="lazy"
                />
                <div>
                  <p className="eyebrow">{story.tag}</p>
                  <h2>{story.title}</h2>
                  <p>{story.description}</p>
                  <InternalLink href={story.href} navigate={navigate} className="text-link">
                    Explore the program <Icon name="arrow" />
                  </InternalLink>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <GetInvolved navigate={navigate} />
    </>
  );
}

function CSRBuilder() {
  const [step, setStep] = useState(1);
  const [program, setProgram] = useState("");
  const [model, setModel] = useState("");
  const [outcome, setOutcome] = useState("");
  const [details, setDetails] = useState({
    name: "",
    email: "",
    phone: "",
    organisation: "",
    message: "",
    consent: false,
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { submission, submit, verificationToken, setVerificationToken, verificationResetKey } =
    usePublicSubmission();
  const outcomes = [
    "Healthier children",
    "Education continuity",
    "Women's earning pathways",
    "Community resilience",
  ];
  const previousStep = useRef(step);

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("csr-step-heading")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  const showSelectionError = (message: string) => {
    setErrors({ selection: message });
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.builder-panel [role="radiogroup"]')?.focus();
    });
  };

  const next = () => {
    if (step === 1 && !program) return showSelectionError("Choose a program to continue.");
    if (step === 2 && !model) return showSelectionError("Choose a partnership model to continue.");
    if (step === 3 && !outcome) return showSelectionError("Choose an outcome goal to continue.");
    setErrors({});
    setStep((current) => Math.min(current + 1, 4));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const formElement = event.currentTarget as HTMLFormElement;
    const nextErrors: Record<string, string> = {};
    if (details.name.trim().length < 2) nextErrors.name = "Please enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(details.email))
      nextErrors.email = "Please enter a valid email address.";
    if (details.organisation.trim().length < 2)
      nextErrors.organisation = "Please enter your organisation.";
    if (!details.consent) nextErrors.consent = "Consent is required so we can respond.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      window.requestAnimationFrame(() => {
        formElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }
    await submit({
      kind: "csr",
      ...details,
      cause: program,
      partnershipModel: model,
      outcomeGoal: outcome,
      consent: details.consent,
    });
  };

  if (submission.status === "sent") {
    return (
      <div className="builder-success" role="status">
        <span>
          <Icon name="check" />
        </span>
        <p className="eyebrow">Partnership enquiry received</p>
        <h3>Thank you. Let’s move from intention to implementation.</h3>
        <p>Our team will review the program, model and outcome you selected before responding.</p>
        <p className="form-reference">Reference: {submission.reference}</p>
      </div>
    );
  }

  return (
    <div className="csr-builder">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Partnership builder step {step} of 4
      </div>
      <div className="builder-progress" aria-label={`Step ${step} of 4`}>
        {["Program", "Model", "Outcome", "Details"].map((label, index) => (
          <div
            key={label}
            className={
              index + 1 <= step
                ? "builder-progress__step builder-progress__step--active"
                : "builder-progress__step"
            }
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <small>{label}</small>
          </div>
        ))}
      </div>
      {step === 1 ? (
        <div className="builder-panel">
          <p className="eyebrow">Step 1</p>
          <h3 id="csr-step-heading" tabIndex={-1}>
            Choose a program
          </h3>
          <div
            className="choice-grid choice-grid--three"
            role="radiogroup"
            tabIndex={-1}
            aria-invalid={Boolean(errors.selection)}
            aria-labelledby="csr-step-heading"
            aria-describedby={errors.selection ? "csr-selection-error" : undefined}
          >
            {programs.map((item) => (
              <button
                key={item.slug}
                type="button"
                className={
                  program === item.shortTitle ? "choice-card choice-card--selected" : "choice-card"
                }
                role="radio"
                aria-checked={program === item.shortTitle}
                onClick={() => setProgram(item.shortTitle)}
              >
                <span>
                  <Icon
                    name={
                      item.slug === "childrens-health"
                        ? "heart"
                        : item.slug === "education"
                          ? "report"
                          : "leaf"
                    }
                  />
                </span>
                <strong>{item.shortTitle}</strong>
                <small>{item.summary}</small>
                {program === item.shortTitle ? <Icon name="check" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="builder-panel">
          <p className="eyebrow">Step 2</p>
          <h3 id="csr-step-heading" tabIndex={-1}>
            Choose a partnership model
          </h3>
          <div
            className="choice-grid"
            role="radiogroup"
            tabIndex={-1}
            aria-invalid={Boolean(errors.selection)}
            aria-labelledby="csr-step-heading"
            aria-describedby={errors.selection ? "csr-selection-error" : undefined}
          >
            {partnershipModels.map((item) => (
              <button
                key={item.title}
                type="button"
                className={
                  model === item.title ? "choice-card choice-card--selected" : "choice-card"
                }
                role="radio"
                aria-checked={model === item.title}
                onClick={() => setModel(item.title)}
              >
                <strong>{item.title}</strong>
                <small>{item.description}</small>
                {model === item.title ? <Icon name="check" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="builder-panel">
          <p className="eyebrow">Step 3</p>
          <h3 id="csr-step-heading" tabIndex={-1}>
            Choose the outcome you want to advance
          </h3>
          <div
            className="choice-grid choice-grid--two"
            role="radiogroup"
            tabIndex={-1}
            aria-invalid={Boolean(errors.selection)}
            aria-labelledby="csr-step-heading"
            aria-describedby={errors.selection ? "csr-selection-error" : undefined}
          >
            {outcomes.map((item) => (
              <button
                key={item}
                type="button"
                className={outcome === item ? "choice-card choice-card--selected" : "choice-card"}
                role="radio"
                aria-checked={outcome === item}
                onClick={() => setOutcome(item)}
              >
                <strong>{item}</strong>
                {outcome === item ? <Icon name="check" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {step === 4 ? (
        <form className="builder-panel form-grid" onSubmit={handleSubmit} noValidate>
          <p className="eyebrow">Step 4</p>
          <h3 id="csr-step-heading" tabIndex={-1}>
            Tell us who to speak with
          </h3>
          <div className="builder-summary">
            <span>{program}</span>
            <span>{model}</span>
            <span>{outcome}</span>
          </div>
          <div className="form-grid__two">
            <TextField
              label="Full name *"
              name="csr-name"
              autoComplete="name"
              value={details.name}
              onChange={(event) => setDetails({ ...details, name: event.target.value })}
              error={errors.name}
            />
            <TextField
              label="Work email *"
              name="csr-email"
              type="email"
              autoComplete="email"
              value={details.email}
              onChange={(event) => setDetails({ ...details, email: event.target.value })}
              error={errors.email}
            />
          </div>
          <div className="form-grid__two">
            <TextField
              label="Organisation *"
              name="csr-organisation"
              autoComplete="organization"
              value={details.organisation}
              onChange={(event) => setDetails({ ...details, organisation: event.target.value })}
              error={errors.organisation}
            />
            <TextField
              label="Phone"
              name="csr-phone"
              type="tel"
              autoComplete="tel"
              value={details.phone}
              onChange={(event) => setDetails({ ...details, phone: event.target.value })}
            />
          </div>
          <TextAreaField
            label="Anything else we should know?"
            name="csr-message"
            rows={4}
            value={details.message}
            onChange={(event) => setDetails({ ...details, message: event.target.value })}
          />
          <label className="honeypot" aria-hidden="true">
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={details.website}
              onChange={(event) => setDetails({ ...details, website: event.target.value })}
            />
          </label>
          <ConsentField
            id="csr-consent"
            checked={details.consent}
            onChange={(checked) => setDetails({ ...details, consent: checked })}
            error={errors.consent}
          >
            I agree to Noel Foundation using these details to respond to this partnership enquiry. *
          </ConsentField>
          {backendConfigured ? (
            <HumanVerification
              action="csr"
              onToken={setVerificationToken}
              resetKey={verificationResetKey}
            />
          ) : null}
          {submission.status === "error" ? (
            <p className="form-alert form-alert--error" role="alert">
              {submission.message}
            </p>
          ) : null}
          {submission.status === "fallback" ? (
            <p className="form-alert" role="status">
              Your email app has opened. If it did not,{" "}
              <a href={submission.fallbackHref}>continue by email</a>.
            </p>
          ) : null}
          <button
            type="submit"
            className="button button--primary button--large"
            disabled={submission.status === "sending" || (backendConfigured && !verificationToken)}
          >
            {submission.status === "sending" ? "Sending..." : "Submit partnership enquiry"}
            <Icon name="arrow" />
          </button>
        </form>
      ) : null}
      {errors.selection ? (
        <p className="builder-error" id="csr-selection-error" role="alert">
          {errors.selection}
        </p>
      ) : null}
      {step < 4 ? (
        <div className="builder-actions">
          <button
            type="button"
            className="button button--ghost"
            disabled={step === 1}
            onClick={() => {
              setErrors({});
              setStep((current) => Math.max(current - 1, 1));
            }}
          >
            <Icon name="chevron-left" /> Back
          </button>
          <button type="button" className="button button--primary" onClick={next}>
            Continue <Icon name="arrow" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="button button--ghost builder-back"
          onClick={() => setStep(3)}
        >
          <Icon name="chevron-left" /> Change selections
        </button>
      )}
    </div>
  );
}

function CSRPage({ navigate }: { navigate: Navigate }) {
  return (
    <>
      <PageHero
        eyebrow="CSR partnerships"
        title={
          <>
            Your CSR. Our community reach. <em>Shared impact.</em>
          </>
        }
        description="Co-create a focused, human-centred program across children's health, education or women's livelihoods."
        image="/images/community-relief.jpg"
        imageAlt="Noel Foundation team members with a community participant during an outreach initiative"
      >
        <InternalLink href="/impact" navigate={navigate} className="button button--secondary">
          Explore our impact model
        </InternalLink>
      </PageHero>
      <section className="section">
        <div className="container-shell">
          <SectionHeading
            eyebrow="Partnership models"
            title={
              <>
                A model for every stage of <em>commitment.</em>
              </>
            }
            description="Start with a focused sponsorship or build a longer strategic program around shared outcomes."
          />
          <div className="csr-model-grid">
            {partnershipModels.map((item, index) => (
              <article key={item.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section section--cream" id="csr-builder">
        <div className="container-shell">
          <SectionHeading
            eyebrow="Partnership builder"
            title={
              <>
                Shape the first conversation in <em>four simple steps.</em>
              </>
            }
            description="This is not a pricing calculator. It helps our team understand the program and outcome you want to explore."
            align="center"
          />
          <CSRBuilder />
        </div>
      </section>
      <section className="section">
        <div className="container-shell">
          <SectionHeading
            eyebrow="From discovery to reporting"
            title="A partnership journey with clear stages."
          />
          <div className="csr-timeline">
            {[
              "Discovery",
              "Program selection",
              "Partnership design",
              "Implementation",
              "Impact measurement",
              "Reporting",
            ].map((item, index) => (
              <div key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section section--blue">
        <div className="container-shell sdg-grid">
          <SectionHeading
            eyebrow="Sustainable Development Goals"
            title={
              <>
                Local programs connected to <em>shared global goals.</em>
              </>
            }
            description="The final SDG mapping for any partnership is confirmed during program design."
            invert
          />
          <div className="sdg-cards">
            {sdgs.map((sdg) => (
              <article key={sdg.number}>
                <span>{sdg.number}</span>
                <h3>{sdg.label}</h3>
                <p>{sdg.programs}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function VolunteerPage({ navigate }: { navigate: Navigate }) {
  const causes = [
    ...programs.map((program) => program.shortTitle),
    "Community Outreach",
    "Employee Volunteering",
  ];
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    cause: "",
    availability: "",
    skills: "",
    areaOfInterest: "",
    experience: "",
    message: "",
    communicationPreference: "Email",
    consent: false,
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const {
    submission,
    submit,
    reset,
    verificationToken,
    setVerificationToken,
    verificationResetKey,
  } = usePublicSubmission();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const formElement = event.currentTarget as HTMLFormElement;
    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 2) nextErrors.name = "Please enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email))
      nextErrors.email = "Please enter a valid email address.";
    if (!form.phone.trim()) nextErrors.phone = "Please enter a phone number.";
    if (!form.city.trim()) nextErrors.city = "Please enter your city.";
    if (!form.cause) nextErrors.cause = "Choose a cause.";
    if (!form.availability) nextErrors.availability = "Choose your availability.";
    if (!form.consent) nextErrors.consent = "Consent is required so we can respond.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      window.requestAnimationFrame(() => {
        formElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }
    await submit({ kind: "volunteer", ...form, consent: form.consent });
  };

  if (submission.status === "sent") {
    return (
      <>
        <PageHero
          eyebrow="Volunteer application"
          title={
            <>
              Thank you for joining <em>the movement.</em>
            </>
          }
          description="Your interest has reached Noel Foundation. The team will review your selected cause and availability before contacting you."
        />
        <section className="section">
          <div className="container-shell narrow-shell">
            <div className="form-success">
              <span>
                <Icon name="check" />
              </span>
              <p className="eyebrow">Application received</p>
              <h2>{form.cause}</h2>
              <p>
                Application reference: <strong>{submission.reference}</strong>
              </p>
              <div className="button-row">
                <InternalLink href="/impact" navigate={navigate} className="button button--primary">
                  Explore impact <Icon name="arrow" />
                </InternalLink>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => {
                    reset();
                    setForm({
                      name: "",
                      email: "",
                      phone: "",
                      city: "",
                      cause: "",
                      availability: "",
                      skills: "",
                      areaOfInterest: "",
                      experience: "",
                      message: "",
                      communicationPreference: "Email",
                      consent: false,
                      website: "",
                    });
                  }}
                >
                  Submit another application
                </button>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Volunteer with Noel Foundation"
        title={
          <>
            Give time. Share skills. <em>Create impact.</em>
          </>
        }
        description="Join community outreach and program initiatives in a role aligned with your interests, availability and experience."
        image="/images/outreach-team.jpg"
        imageAlt="Noel Foundation community outreach volunteers in Chennai"
      />
      <section className="section">
        <div className="container-shell volunteer-layout">
          <aside>
            <p className="eyebrow">What happens next</p>
            <h2>A thoughtful match, not an automatic placement.</h2>
            <div className="mini-timeline">
              {[
                ["01", "Apply"],
                ["02", "Review"],
                ["03", "Conversation"],
                ["04", "Placement"],
              ].map(([number, label]) => (
                <p key={label}>
                  <span>{number}</span>
                  <strong>{label}</strong>
                </p>
              ))}
            </div>
            <div className="privacy-note">
              <Icon name="shield" />
              <p>
                <strong>Your privacy matters</strong>Your contact details and application message
                are never displayed publicly.
              </p>
            </div>
          </aside>
          <form className="form-card form-grid" onSubmit={handleSubmit} noValidate>
            <div>
              <p className="eyebrow" id="volunteer-cause-label">
                Choose a cause
              </p>
              <div
                className="cause-grid"
                role="radiogroup"
                tabIndex={-1}
                aria-invalid={Boolean(errors.cause)}
                aria-labelledby="volunteer-cause-label"
                aria-describedby={errors.cause ? "volunteer-cause-error" : undefined}
              >
                {causes.map((cause) => (
                  <button
                    key={cause}
                    type="button"
                    className={
                      form.cause === cause ? "cause-card cause-card--selected" : "cause-card"
                    }
                    role="radio"
                    aria-checked={form.cause === cause}
                    onClick={() => setForm({ ...form, cause })}
                  >
                    <Icon
                      name={
                        cause.includes("Health")
                          ? "heart"
                          : cause === "Education"
                            ? "report"
                            : cause.includes("Livelihood")
                              ? "leaf"
                              : "people"
                      }
                    />
                    <span>{cause}</span>
                    {form.cause === cause ? <Icon name="check" /> : null}
                  </button>
                ))}
              </div>
              {errors.cause ? (
                <p className="field__error" id="volunteer-cause-error" role="alert">
                  {errors.cause}
                </p>
              ) : null}
            </div>
            <div className="form-grid__two">
              <TextField
                label="Full name *"
                name="volunteer-name"
                autoComplete="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                error={errors.name}
              />
              <TextField
                label="Email address *"
                name="volunteer-email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                error={errors.email}
              />
            </div>
            <div className="form-grid__two">
              <TextField
                label="Phone *"
                name="volunteer-phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                error={errors.phone}
              />
              <TextField
                label="City *"
                name="volunteer-city"
                autoComplete="address-level2"
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
                error={errors.city}
              />
            </div>
            <div className="form-grid__two">
              <SelectField
                label="Availability *"
                name="volunteer-availability"
                value={form.availability}
                onChange={(event) => setForm({ ...form, availability: event.target.value })}
                error={errors.availability}
              >
                <option value="">Choose availability</option>
                <option>Weekdays</option>
                <option>Weekends</option>
                <option>Both</option>
                <option>Flexible</option>
              </SelectField>
              <SelectField
                label="Preferred communication"
                name="volunteer-communication"
                value={form.communicationPreference}
                onChange={(event) =>
                  setForm({
                    ...form,
                    communicationPreference: event.target.value,
                  })
                }
              >
                <option>Email</option>
                <option>Phone</option>
                <option>WhatsApp</option>
              </SelectField>
            </div>
            <div className="form-grid__two">
              <TextField
                label="Skills"
                name="volunteer-skills"
                value={form.skills}
                onChange={(event) => setForm({ ...form, skills: event.target.value })}
                hint="For example: teaching, design, healthcare, operations"
              />
              <TextField
                label="Area of interest"
                name="volunteer-interest"
                value={form.areaOfInterest}
                onChange={(event) => setForm({ ...form, areaOfInterest: event.target.value })}
              />
            </div>
            <TextAreaField
              label="Relevant experience (optional)"
              name="volunteer-experience"
              rows={3}
              value={form.experience}
              onChange={(event) => setForm({ ...form, experience: event.target.value })}
            />
            <TextAreaField
              label="Message"
              name="volunteer-message"
              rows={4}
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
            />
            <label className="honeypot" aria-hidden="true">
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
              />
            </label>
            <ConsentField
              id="volunteer-consent"
              checked={form.consent}
              onChange={(checked) => setForm({ ...form, consent: checked })}
              error={errors.consent}
            >
              I agree to Noel Foundation using these details to assess and respond to my volunteer
              application. *
            </ConsentField>
            {backendConfigured ? (
              <HumanVerification
                action="volunteer"
                onToken={setVerificationToken}
                resetKey={verificationResetKey}
              />
            ) : null}
            {submission.status === "error" ? (
              <p className="form-alert form-alert--error" role="alert">
                {submission.message}
              </p>
            ) : null}
            {submission.status === "fallback" ? (
              <p className="form-alert" role="status">
                Your email app has opened. If it did not,{" "}
                <a href={submission.fallbackHref}>continue by email</a>.
              </p>
            ) : null}
            <button
              type="submit"
              className="button button--primary button--large"
              disabled={
                submission.status === "sending" || (backendConfigured && !verificationToken)
              }
            >
              {submission.status === "sending"
                ? "Sending application..."
                : "Submit volunteer application"}
              <Icon name="arrow" />
            </button>
          </form>
        </div>
      </section>
    </>
  );
}

function DonatePage({ navigate }: { navigate: Navigate }) {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState<number | "custom" | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [cause, setCause] = useState("");
  const [error, setError] = useState("");
  const effectiveAmount = amount === "custom" ? Number(customAmount) : amount;
  const causes = ["Where Needed Most", "Children's Health", "Education", "Women's Livelihoods"];
  const previousStep = useRef(step);

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("donation-step-heading")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  const showStepError = (message: string) => {
    setError(message);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.donation-step [role="radiogroup"]')?.focus();
    });
  };

  const next = () => {
    if (step === 1 && (!effectiveAmount || effectiveAmount < 100))
      return showStepError("Choose or enter a contribution of at least ₹100.");
    if (step === 2 && !cause)
      return showStepError("Choose where you would like your contribution directed.");
    setError("");
    setStep((current) => Math.min(current + 1, 3));
  };

  return (
    <>
      <PageHero
        eyebrow="Support our work"
        title={
          <>
            Help create impact <em>that lasts.</em>
          </>
        }
        description="Choose a contribution and cause, then continue through Noel Foundation's approved donation process."
        image="/images/family-medical-support.jpg"
        imageAlt="A Noel Foundation representative meeting a child and caregiver during a hospital visit"
      />
      <section className="section section--cream">
        <div className="container-shell donate-layout">
          <div className="donation-panel">
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              Donation preparation step {step} of 3
            </div>
            <div
              className="donation-progress"
              aria-label={`Donation preparation step ${step} of 3`}
            >
              {[
                ["01", "Contribution"],
                ["02", "Cause"],
                ["03", "Secure payment"],
              ].map(([number, label], index) => (
                <div
                  key={label}
                  className={
                    index + 1 <= step
                      ? "donation-progress__item donation-progress__item--active"
                      : "donation-progress__item"
                  }
                >
                  <span>{number}</span>
                  <small>{label}</small>
                </div>
              ))}
            </div>
            {step === 1 ? (
              <div className="donation-step">
                <p className="eyebrow">One-time contribution</p>
                <h2 id="donation-step-heading" tabIndex={-1}>
                  Choose an amount
                </h2>
                <div
                  className="amount-grid"
                  role="radiogroup"
                  tabIndex={-1}
                  aria-invalid={Boolean(error)}
                  aria-labelledby="donation-step-heading"
                  aria-describedby={error ? "donation-step-error" : undefined}
                >
                  {[1000, 5000, 15000, 30000].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={
                        amount === value ? "amount-card amount-card--selected" : "amount-card"
                      }
                      role="radio"
                      aria-checked={amount === value}
                      onClick={() => {
                        setAmount(value);
                        setError("");
                      }}
                    >
                      ₹{new Intl.NumberFormat("en-IN").format(value)}
                      {amount === value ? <Icon name="check" /> : null}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={
                      amount === "custom" ? "amount-card amount-card--selected" : "amount-card"
                    }
                    role="radio"
                    aria-checked={amount === "custom"}
                    onClick={() => {
                      setAmount("custom");
                      setError("");
                    }}
                  >
                    Custom{amount === "custom" ? <Icon name="check" /> : null}
                  </button>
                </div>
                {amount === "custom" ? (
                  <TextField
                    label="Custom amount (₹)"
                    name="custom-amount"
                    type="number"
                    min="100"
                    inputMode="numeric"
                    value={customAmount}
                    onChange={(event) => setCustomAmount(event.target.value)}
                  />
                ) : null}
                <div className="frequency-note">
                  <div>
                    <strong>One time</strong>
                    <small>Selected for this review</small>
                  </div>
                  <button type="button" disabled aria-disabled="true">
                    Monthly <span>Available after recurring mandate approval</span>
                  </button>
                </div>
              </div>
            ) : null}
            {step === 2 ? (
              <div className="donation-step">
                <p className="eyebrow">Direct your support</p>
                <h2 id="donation-step-heading" tabIndex={-1}>
                  Choose a cause
                </h2>
                <div
                  className="donation-cause-grid"
                  role="radiogroup"
                  tabIndex={-1}
                  aria-invalid={Boolean(error)}
                  aria-labelledby="donation-step-heading"
                  aria-describedby={error ? "donation-step-error" : undefined}
                >
                  {causes.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={
                        cause === item
                          ? "donation-cause donation-cause--selected"
                          : "donation-cause"
                      }
                      role="radio"
                      aria-checked={cause === item}
                      onClick={() => {
                        setCause(item);
                        setError("");
                      }}
                    >
                      <Icon
                        name={
                          item.includes("Health")
                            ? "heart"
                            : item === "Education"
                              ? "report"
                              : item.includes("Livelihood")
                                ? "leaf"
                                : "spark"
                        }
                      />
                      <span>
                        <strong>{item}</strong>
                        <small>
                          {item === "Where Needed Most"
                            ? "Let Noel Foundation direct the contribution to an approved priority."
                            : "Support this program area through the secure donation process."}
                        </small>
                      </span>
                      {cause === item ? <Icon name="check" /> : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {step === 3 ? (
              <div className="donation-step">
                <p className="eyebrow">Secure payment hand-off</p>
                <h2 id="donation-step-heading" tabIndex={-1}>
                  Review your selection
                </h2>
                <div className="donation-review">
                  <div>
                    <small>Contribution</small>
                    <strong>₹{new Intl.NumberFormat("en-IN").format(effectiveAmount || 0)}</strong>
                  </div>
                  <div>
                    <small>Cause</small>
                    <strong>{cause}</strong>
                  </div>
                  <div>
                    <small>Frequency</small>
                    <strong>One time</strong>
                  </div>
                </div>
                <div className="secure-note">
                  <Icon name="shield" />
                  <p>
                    <strong>No payment details are collected or transmitted from this page.</strong>
                    This review helps you prepare. The approved payment provider will ask you to
                    enter or confirm the contribution details. A contribution is counted only after
                    payment confirmation.
                  </p>
                </div>
                {DONATION_URL ? (
                  <a
                    href={DONATION_URL}
                    className="button button--primary button--large button--wide"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Continue to secure donation <Icon name="external" />
                  </a>
                ) : (
                  <div className="donation-handoff">
                    <p>
                      <strong>Live online payment is awaiting final approval.</strong>
                      Contact Noel Foundation with your reviewed amount and cause, and the team will
                      share the approved contribution process.
                    </p>
                    <a
                      href={`mailto:${contact.email}?subject=${encodeURIComponent("Donation support")}&body=${encodeURIComponent(`Hello Noel Foundation,\n\nI would like to contribute ₹${new Intl.NumberFormat("en-IN").format(effectiveAmount || 0)} toward ${cause}. Please share the approved donation process.\n\nThank you.`)}`}
                      className="button button--primary button--large button--wide"
                    >
                      Request donation assistance <Icon name="mail" />
                    </a>
                  </div>
                )}
                <p className="donation-policy-links">
                  Review the{" "}
                  <InternalLink href="/refund-policy" navigate={navigate}>
                    refund policy
                  </InternalLink>{" "}
                  before contributing.
                </p>
              </div>
            ) : null}
            {error ? (
              <p className="builder-error" id="donation-step-error" role="alert">
                {error}
              </p>
            ) : null}
            {step < 3 ? (
              <div className="builder-actions">
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={step === 1}
                  onClick={() => setStep((current) => Math.max(current - 1, 1))}
                >
                  <Icon name="chevron-left" /> Back
                </button>
                <button type="button" className="button button--primary" onClick={next}>
                  Continue <Icon name="arrow" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button button--ghost builder-back"
                onClick={() => setStep(2)}
              >
                <Icon name="chevron-left" /> Change selection
              </button>
            )}
          </div>
          <aside className="donation-aside">
            <p className="eyebrow">Contribution ethics</p>
            <h3>Clear. Voluntary. Respectful.</h3>
            {[
              "No hidden recurring selection",
              "No fake urgency or countdowns",
              "No payment details stored here",
              "Only confirmed payments count toward totals",
              "Tax eligibility should be verified on the payment page",
            ].map((item) => (
              <p key={item}>
                <Icon name="check" /> {item}
              </p>
            ))}
            <InternalLink href="/contact" navigate={navigate} className="text-link">
              Questions about giving? Contact us <Icon name="arrow" />
            </InternalLink>
          </aside>
        </div>
      </section>
    </>
  );
}

function ReportsPage({ navigate }: { navigate: Navigate }) {
  const requestHref = `mailto:${contact.email}?subject=${encodeURIComponent("Request for Noel Foundation governance document")}`;
  return (
    <>
      <PageHero
        eyebrow="Reports & governance"
        title={
          <>
            Transparency that makes <em>partnership stronger.</em>
          </>
        }
        description="Explore the currently available public archive and request the documents relevant to your partnership review."
      />
      <section className="section section--cream">
        <div className="container-shell">
          <SectionHeading
            eyebrow="Public archive"
            title="Report archive"
            description="Only approved report files are linked publicly. Additional documents can be requested for due diligence."
          />
          {ANNUAL_REPORT_URL ? (
            <a
              className="featured-report"
              href={ANNUAL_REPORT_URL}
              target="_blank"
              rel="noreferrer"
            >
              <div>
                <p className="eyebrow">Annual report</p>
                <h2>2019-2020: A Year of Celebration</h2>
                <p>Open the approved archived annual report in a new tab.</p>
              </div>
              <span>
                <Icon name="external" />
              </span>
            </a>
          ) : (
            <article className="featured-report featured-report--pending">
              <div>
                <p className="eyebrow">Annual report · archive migration</p>
                <h2>2019-2020: A Year of Celebration</h2>
                <p>The approved report file is awaiting publication on the new website.</p>
                <a href={requestHref} className="button button--light">
                  Request this report <Icon name="mail" />
                </a>
              </div>
              <span>
                <Icon name="report" />
              </span>
            </article>
          )}
        </div>
      </section>
      <section className="section">
        <div className="container-shell">
          <SectionHeading
            eyebrow="Document access"
            title={
              <>
                Request the material needed for <em>responsible due diligence.</em>
              </>
            }
            description="Current statutory, financial and program documents should be shared only after internal approval."
          />
          <div className="report-grid">
            {[
              ["Compliance documents", "Applicable registrations and supporting documentation."],
              [
                "Financial transparency",
                "Approved financial or audit material for partner review.",
              ],
              ["Program reports", "Program delivery, outputs and learning summaries."],
              ["Impact reports", "Verified outcome data and program-specific reporting."],
            ].map(([title, description]) => (
              <article key={title}>
                <span>
                  <Icon name="report" />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
                <a href={requestHref}>
                  Request document <Icon name="arrow" />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section section--blue">
        <div className="container-shell report-cta">
          <div>
            <p className="eyebrow">Planning a CSR review?</p>
            <h2>Let’s prepare the right documentation for your team.</h2>
          </div>
          <InternalLink href="/csr" navigate={navigate} className="button button--light">
            Start a partnership enquiry <Icon name="arrow" />
          </InternalLink>
        </div>
      </section>
    </>
  );
}

function EventsPage({ navigate }: { navigate: Navigate }) {
  const gallery = [
    ["/images/community-program-press.jpg", "Community education outreach coverage"],
    ["/images/food-kit-distribution.jpg", "Essential support distributed with community members"],
    ["/images/community-food-support.jpg", "Community support outreach in Chennai"],
  ];
  return (
    <>
      <PageHero
        eyebrow="Events & updates"
        title={
          <>
            Community in action. <em>Stories in motion.</em>
          </>
        }
        description="Program events and community updates will be published here after details and media permissions are confirmed."
        image="/images/student-kit-distribution.jpg"
        imageAlt="A Noel Foundation education outreach event"
      />
      <section className="section">
        <div className="container-shell">
          <SectionHeading
            eyebrow="From the field"
            title="A glimpse of community outreach."
            description="Archive photography from Noel Foundation initiatives. No event date or outcome is inferred unless a verified record is available."
          />
          <div className="gallery-grid">
            {gallery.map(([image, alt]) => (
              <figure key={image}>
                <img src={image} alt={alt} width="900" height="674" loading="lazy" />
                <figcaption>{alt}</figcaption>
              </figure>
            ))}
          </div>
          <div className="empty-state">
            <Icon name="report" />
            <div>
              <h3>New event listings are being prepared.</h3>
              <p>
                Contact the Foundation for confirmed upcoming opportunities or institutional
                participation.
              </p>
            </div>
            <InternalLink href="/contact" navigate={navigate} className="button button--secondary">
              Contact us
            </InternalLink>
          </div>
        </div>
      </section>
    </>
  );
}

function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact Noel Foundation"
        title={
          <>
            Let’s start with a <em>meaningful conversation.</em>
          </>
        }
        description="Reach the team about programs, partnerships, volunteering, donations or another way to create impact."
      />
      <section className="section">
        <div className="container-shell contact-page-grid">
          <aside>
            <p className="eyebrow">Contact details</p>
            <h2>Chennai, Tamil Nadu</h2>
            <div className="contact-list">
              <a href={`tel:${contact.phoneHref}`}>
                <span>
                  <Icon name="phone" />
                </span>
                <div>
                  <small>Phone</small>
                  <strong>{contact.phoneDisplay}</strong>
                </div>
              </a>
              <a href={`mailto:${contact.email}`}>
                <span>
                  <Icon name="mail" />
                </span>
                <div>
                  <small>Email</small>
                  <strong>{contact.email}</strong>
                </div>
              </a>
              <div>
                <span>
                  <Icon name="pin" />
                </span>
                <div>
                  <small>Office</small>
                  {contact.address.map((line) => (
                    <strong key={line}>{line}</strong>
                  ))}
                </div>
              </div>
            </div>
            <div className="social-row">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Noel Foundation on ${link.label}`}
                >
                  {link.label.slice(0, 2)}
                </a>
              ))}
            </div>
          </aside>
          <div className="form-card">
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}

const legalContent: Record<
  string,
  {
    eyebrow: string;
    title: string;
    description: string;
    principles?: string[];
  }
> = {
  "/privacy": {
    eyebrow: "Privacy",
    title: "Respecting the people behind every record.",
    description:
      "Noel Foundation's website should collect only the information needed to respond, coordinate participation or complete an authorised contribution.",
    principles: [
      "Private contact, donor, volunteer and beneficiary details are not displayed publicly.",
      "Story publication requires appropriate consent and visibility approval.",
      "Payment credentials such as card numbers, CVV or UPI credentials are never stored by this website.",
      "People may contact the Foundation to request correction or removal of information they submitted.",
    ],
  },
  "/terms": {
    eyebrow: "Terms",
    title: "Clear expectations for using this website.",
    description:
      "This summary explains the website's current operating approach. Formal terms will be published after organisational and legal review.",
  },
  "/refund-policy": {
    eyebrow: "Refund policy",
    title: "Review the current policy before contributing.",
    description:
      "Refund terms and payment-provider timelines will be published with the approved live contribution process.",
  },
};

function LegalPage({ path }: { path: string }) {
  if (path === "/accessibility") {
    return (
      <>
        <PageHero
          eyebrow="Accessibility"
          title={
            <>
              A website designed for <em>more people.</em>
            </>
          }
          description="Noel Foundation aims for a clear, keyboard-friendly and responsive experience across phones, tablets and computers."
        />
        <section className="section">
          <div className="container-shell legal-grid">
            <div>
              <h2>Accessibility commitments</h2>
              <p>
                This experience supports visible keyboard focus, semantic headings, labelled forms,
                44px touch targets, reduced motion preferences and strong text contrast.
              </p>
              <p>
                If a page, form or document is difficult to use, contact us and describe the
                barrier, device and browser if possible.
              </p>
              <a
                href={`mailto:${contact.email}?subject=${encodeURIComponent("Website accessibility feedback")}`}
                className="button button--primary"
              >
                Report an accessibility issue <Icon name="mail" />
              </a>
            </div>
            <div className="legal-principles">
              {[
                "Keyboard navigation",
                "Visible focus states",
                "Reduced-motion support",
                "Responsive reflow",
                "Form labels and errors",
                "Meaningful image descriptions",
              ].map((item) => (
                <p key={item}>
                  <Icon name="check" /> {item}
                </p>
              ))}
            </div>
          </div>
        </section>
      </>
    );
  }
  const content = legalContent[path] || legalContent["/privacy"];
  return (
    <>
      <PageHero
        eyebrow={content.eyebrow}
        title={<>{content.title}</>}
        description={content.description}
      />
      <section className="section">
        <div className="container-shell legal-grid">
          <div>
            <h2>Our website approach</h2>
            <p>
              The new website experience follows privacy-first, consent-aware and honest-data
              principles. Formal policy language must be approved by Noel Foundation before it is
              presented as a governing document.
            </p>
            <a
              href={`mailto:${contact.email}?subject=${encodeURIComponent(`Request for Noel Foundation ${content.eyebrow.toLowerCase()} document`)}`}
              className="button button--primary"
            >
              Request the formal policy <Icon name="mail" />
            </a>
          </div>
          {content.principles ? (
            <div className="legal-principles">
              {content.principles.map((item) => (
                <p key={item}>
                  <Icon name="check" /> {item}
                </p>
              ))}
            </div>
          ) : (
            <div className="privacy-note">
              <Icon name="report" />
              <p>
                <strong>Organisational review</strong>For clarification, contact {contact.email}{" "}
                before relying on this page for a legal or payment decision.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function AdminGate() {
  return (
    <>
      <PageHero
        eyebrow="Restricted administration"
        title={
          <>
            Authorised team access <em>only.</em>
          </>
        }
        description="Public visitors cannot access beneficiary, supporter, volunteer, donation or program-management records from this route."
      />
      <section className="section">
        <div className="container-shell narrow-shell">
          <div className="secure-note">
            <Icon name="shield" />
            <p>
              <strong>The administration layer is intentionally closed.</strong>
              Authentication, role-based permissions and organisation approval are required before a
              production CMS is connected.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function NotFound({ navigate }: { navigate: Navigate }) {
  return (
    <section className="not-found">
      <div className="container-shell">
        <p className="eyebrow">404</p>
        <h1>This page has moved.</h1>
        <p>Return home or explore Noel Foundation's three program areas.</p>
        <div className="button-row">
          <InternalLink href="/" navigate={navigate} className="button button--primary">
            Return home
          </InternalLink>
          <InternalLink href="/programs" navigate={navigate} className="button button--secondary">
            Explore programs
          </InternalLink>
        </div>
      </div>
    </section>
  );
}

function Footer({ navigate }: { navigate: Navigate }) {
  const columns = [
    { title: "About", links: aboutLinks },
    { title: "Programs", links: programLinks },
    { title: "Get involved", links: involveLinks },
    {
      title: "Resources",
      links: [
        { label: "Impact", href: "/impact" },
        { label: "Reports", href: "/reports" },
        { label: "Events", href: "/events" },
        { label: "Accessibility", href: "/accessibility" },
      ],
    },
  ];
  return (
    <footer className="site-footer">
      <div className="container-shell site-footer__top">
        <div className="site-footer__brand">
          <Logo inverse />
          <p>
            Creating healthier children, educated communities and economically empowered families.
          </p>
          <div className="social-row">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                aria-label={`Noel Foundation on ${link.label}`}
              >
                {link.label.slice(0, 2)}
              </a>
            ))}
          </div>
        </div>
        <div className="site-footer__nav">
          {columns.map((column) => (
            <div key={column.title}>
              <h2>{column.title}</h2>
              {column.links.map((link) => (
                <InternalLink key={link.href} href={link.href} navigate={navigate}>
                  {link.label}
                </InternalLink>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="container-shell site-footer__contact">
        <div>
          <Icon name="pin" />
          <span>{contact.location}</span>
        </div>
        <a href={`mailto:${contact.email}`}>
          <Icon name="mail" />
          {contact.email}
        </a>
        <a href={`tel:${contact.phoneHref}`}>
          <Icon name="phone" />
          {contact.phoneDisplay}
        </a>
      </div>
      <div className="container-shell site-footer__bottom">
        <p>© {new Date().getFullYear()} Noel Foundation. All rights reserved.</p>
        <div>
          <InternalLink href="/privacy" navigate={navigate}>
            Privacy
          </InternalLink>
          <InternalLink href="/terms" navigate={navigate}>
            Terms
          </InternalLink>
          <InternalLink href="/refund-policy" navigate={navigate}>
            Refund policy
          </InternalLink>
        </div>
        <p>Human First. Impact Driven.</p>
      </div>
    </footer>
  );
}

function FloatingActions({ navigate }: { navigate: Navigate }) {
  const visible = useScrolled(640);
  return (
    <div className={visible ? "floating-actions floating-actions--visible" : "floating-actions"}>
      <InternalLink href="/donate" navigate={navigate} className="floating-donate">
        <Icon name="heart" />
        <span>Donate</span>
      </InternalLink>
      <button
        type="button"
        className="back-to-top"
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <Icon name="chevron-down" />
      </button>
    </div>
  );
}

function AppRoutes({ path, navigate }: { path: string; navigate: Navigate }) {
  if (path === "/") return <HomePage navigate={navigate} />;
  if (["/about", "/about/story", "/about/team", "/about/governance"].includes(path))
    return <AboutPage path={path} navigate={navigate} />;
  if (
    [
      "/programs",
      "/programs/childrens-health",
      "/programs/education",
      "/programs/womens-livelihoods",
    ].includes(path)
  )
    return <ProgramsPage path={path} navigate={navigate} />;
  if (path === "/impact" || path === "/impact/live")
    return <ImpactPage path={path} navigate={navigate} />;
  if (path === "/stories") return <StoriesPage navigate={navigate} />;
  if (path === "/events") return <EventsPage navigate={navigate} />;
  if (path === "/csr") return <CSRPage navigate={navigate} />;
  if (path === "/volunteer") return <VolunteerPage navigate={navigate} />;
  if (path === "/donate") return <DonatePage navigate={navigate} />;
  if (path === "/reports") return <ReportsPage navigate={navigate} />;
  if (path === "/contact") return <ContactPage />;
  if (["/privacy", "/terms", "/refund-policy", "/accessibility"].includes(path))
    return <LegalPage path={path} />;
  if (path.startsWith("/admin")) return <AdminGate />;
  return <NotFound navigate={navigate} />;
}

export default function App() {
  const { path, navigate } = useNavigation();
  const initialPath = useRef(true);

  useEffect(() => {
    if (initialPath.current) {
      initialPath.current = false;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("main-content")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [path]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {pageTitles[path] || "Page not found | Noel Foundation"}
      </div>
      <Header path={path} navigate={navigate} />
      <main id="main-content" tabIndex={-1}>
        <AppRoutes path={path} navigate={navigate} />
      </main>
      <Footer navigate={navigate} />
      <FloatingActions navigate={navigate} />
    </div>
  );
}
