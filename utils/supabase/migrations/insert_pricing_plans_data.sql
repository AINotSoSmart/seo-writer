-- Insert the two payment plans for dodopayments integration
INSERT INTO public.dodo_pricing_plans (
  name,
  description,
  price,
  credits,
  currency,
  dodo_product_id,
  is_active,
  metadata
) VALUES 

(
  'Premium Pack',
  '30 Articles per Month',
  79,
  30,
  'USD',
  'pdt_nCZox8eb5DYwVOvnSRJmT', -- This will be the product ID in dodopayments
  true,
  '{"features": ["30 Articles per Month"]}'
);