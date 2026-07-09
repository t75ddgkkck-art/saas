import { NextResponse } from "next/server";

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export function successResponse<T>(data: T, message?: string): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
  });
}

export function errorResponse(error: string, status: number = 400): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error,
  }, { status });
}

export function unauthorizedResponse(message: string = "Non authentifié"): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error: message,
  }, { status: 401 });
}

export function forbiddenResponse(message: string = "Accès interdit"): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error: message,
  }, { status: 403 });
}

export function notFoundResponse(message: string = "Ressource introuvable"): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error: message,
  }, { status: 404 });
}

export function serverErrorResponse(message: string = "Erreur serveur"): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error: message,
  }, { status: 500 });
}
