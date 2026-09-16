from database_layer.python.connection import get_connection

conn = get_connection()

print("Connected through DevByte DB layer!")

conn.close()