
export interface LoginRequestDTO {
    username: string;
    password: string;
}

export interface LoginResponseDTO {
     status: string;
     message: string;
     token: string;
     refreshToken?: string;
     nombrePersona?: string;
}

export interface LoginMsalRequestDTO {
     token: string;
}

export interface RefreshRequestDto {
     refreshToken?: string;
}

export interface RolJWT {
  id: number;
  nombre: string;
}

export interface JwtPayload {
  sub?: string;
  roles?: RolJWT[];
  exp?: number;
  iat?: number;
  uid?: number | string;
  idUser?: number | string;
  idUsuario?: number | string;
  nombrePersona?: string;
  name?: string;
  unique_name?: string;
}
