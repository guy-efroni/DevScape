import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { ICodeGraph } from '@devscape/shared';
import { API_ORIGIN, API_PARSE_PATH } from '../app.constants';

@Injectable({ providedIn: 'root' })
export class CodeGraphService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_ORIGIN}${API_PARSE_PATH}`;

  parse(directoryPath: string): Observable<ICodeGraph> {
    return this.http.post<ICodeGraph>(this.apiUrl, { directoryPath });
  }

  parseDirectory(directoryPath: string): Observable<ICodeGraph> {
    return this.parse(directoryPath);
  }
}

