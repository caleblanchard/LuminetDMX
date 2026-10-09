import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'An error occurred';
        
        if (error.error instanceof ErrorEvent) {
          // Client-side error
          errorMessage = `Client error: ${error.error.message}`;
        } else {
          // Server-side error
          if (error.status === 0) {
            errorMessage = 'Network error: Unable to connect to server';
          } else if (error.status >= 500) {
            errorMessage = `Server error: ${error.status} - ${error.statusText}`;
          } else if (error.status === 401) {
            errorMessage = 'Unauthorized: Please log in';
          } else if (error.status === 403) {
            errorMessage = 'Forbidden: You do not have permission';
          } else if (error.status === 404) {
            errorMessage = 'Not found: The requested resource does not exist';
          } else if (error.status === 429) {
            errorMessage = 'Rate limit exceeded: Please try again later';
          } else {
            errorMessage = `Error: ${error.message}`;
          }
        }
        
        console.error('HTTP Error:', errorMessage);
        return throwError(() => new Error(errorMessage));
      })
    );
  }
}