-- User and database
-- CREATE USER ${POSTGRES_USER} WITH PASSWORD ${POSTGRES_PASSWORD};
-- CREATE DATABASE ${POSTGRES_DB};
-- GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};

CREATE USER kim WITH PASSWORD "";
CREATE DATABASE snackspild;
GRANT ALL PRIVILEGES ON DATABASE snackspild TO kim;

-- Connect to database
\c snackspild

-- Tables
CREATE TABLE items (
    item_id SERIAL UNIQUE PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INT,
    weight INT NOT NULL,
    expiration_date DATE,
    available BOOLEAN NOT NULL
);

CREATE TABLE types (
    item_id INT UNIQUE PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL,
    isDerived BOOLEAN NOT NULL,
    FOREIGN KEY(item_id) REFERENCES items(item_id)
);

CREATE TABLE nutrition (
    item_id INT UNIQUE PRIMARY KEY,
    calories INT,
    fat DECIMAL(10, 2),
    saturated_fat DECIMAL(10, 2),
    carbohydrates DECIMAL(10, 2),
    sugar DECIMAL(10, 2),
    dietary_fiber DECIMAL(10, 2),
    protein DECIMAL(10, 2),
    salt DECIMAL(10, 2),
    ingredients VARCHAR(500),
    FOREIGN KEY(item_id) REFERENCES items(item_id)
);