CREATE TABLE items (
    item_id SERIAL UNIQUE PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    price_dkk DECIMAL(10, 2) NOT NULL,
    quantity INT,
    weight_grams INT NOT NULL,
    expiration_date DATE,
    available BOOLEAN NOT NULL
);

CREATE TABLE types (
    item_id INT UNIQUE PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL,
    isDerived BOOLEAN NOT NULL,
    FOREIGN KEY(item_id) REFERENCES items(item_id)
);

CREATE TABLE nutrionals (
    item_id INT UNIQUE PRIMARY KEY,
    calories INT NOT NULL,
    fat DECIMAL(10, 2) NOT NULL,
    saturated_fat DECIMAL(10, 2) NOT NULL,
    carbohydrates DECIMAL(10, 2) NOT NULL,
    sugar DECIMAL(10, 2) NOT NULL,
    dietary_fiber DECIMAL(10, 2) NOT NULL,
    protein DECIMAL(10, 2) NOT NULL,
    salt DECIMAL(10, 2) NOT NULL,
    ingredients VARCHAR(500) NOT NULL,
    FOREIGN KEY(item_id) REFERENCES items(item_id)
);