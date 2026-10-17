CREATE SEQUENCE "Order_orderNumber_seq"
    AS BIGINT
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

SELECT setval(
    '"Order_orderNumber_seq"',
    COALESCE(
        MAX(substring("orderNumber" FROM '^G2-PH-([0-9]+)$')::BIGINT),
        0
    ) + 1,
    false
)
FROM "Order";
