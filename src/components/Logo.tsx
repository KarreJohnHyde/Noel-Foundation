export default function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="brand-lockup">
      <span className={inverse ? "brand-image brand-image--inverse" : "brand-image"}>
        <img
          src="/images/noel-logo.png"
          alt="Noel Foundation"
          width="300"
          height="200"
          decoding="async"
        />
      </span>
      <span className="brand-tagline">Touching lives, one little heart at a time</span>
    </span>
  );
}
