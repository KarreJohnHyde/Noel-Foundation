declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

declare module "npm:stripe@22.4.0" {
  const Stripe: any;
  export default Stripe;
}
